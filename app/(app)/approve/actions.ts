"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { pushAction } from "@/lib/google/push";
import { fromLocalInput } from "@/lib/format";

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

// A datetime-local value ("YYYY-MM-DDTHH:mm", no zone) is Toronto wall-clock →
// convert to a correct ISO. A full ISO (already has offset/Z) is kept as-is.
function normalizeStart(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return fromLocalInput(v) ?? v;
  return v;
}

function buildPayload(form: FormData, kind: string): Record<string, unknown> {
  if (kind === "email") {
    return { subject: str(form, "subject"), body: str(form, "body"), to: str(form, "to") };
  }
  if (kind === "sms") {
    return { body: str(form, "body"), to: str(form, "to") };
  }
  if (kind === "calendar_event") {
    return {
      title: str(form, "title"),
      start: normalizeStart(str(form, "start")),
      location: str(form, "location"),
      notes: str(form, "notes"),
    };
  }
  return {};
}

// Save edits + approve. SMS is "done" on approve (you send it from your phone).
// Email / Calendar get pushed to Google as a draft / event (Phase 3).
export async function approveAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  const kind = String(form.get("kind") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("actions_queue")
    .update({ payload: buildPayload(form, kind), status: "approved" })
    .eq("id", id)
    .select("deal_id")
    .maybeSingle();

  // Mark the deal as "follow-up sent" once an email is approved (the human's
  // act of preparing/sending it) — drives the engagement badge on the client.
  if (kind === "email" && row?.deal_id) {
    await supabase
      .from("deals")
      .update({ followup_sent_at: new Date().toISOString() })
      .eq("id", row.deal_id);
  }

  if (kind === "email" || kind === "calendar_event") {
    await doPush(id);
  }
  revalidatePath("/approve");
  revalidatePath("/deals");
}

// Save edits without approving.
export async function saveAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  const kind = String(form.get("kind") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("actions_queue").update({ payload: buildPayload(form, kind) }).eq("id", id);
  revalidatePath("/approve");
}

export async function dismissAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("actions_queue").update({ status: "dismissed" }).eq("id", id);
  revalidatePath("/approve");
}

// Retry a failed/approved push (the "Retry" / "Push to Google" button).
export async function syncAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;
  await doPush(id);
  revalidatePath("/approve");
}

// Perform the Google push for one action and record the outcome (Section 6
// step 7): store external_id + status synced, or status failed + bump retries.
async function doPush(id: string) {
  const supabase = await createClient();
  const { data: action } = await supabase
    .from("actions_queue")
    .select("id, kind, payload, external_id, idempotency_key, retries")
    .eq("id", id)
    .maybeSingle();
  if (!action) return;

  const result = await pushAction(supabase, {
    id: action.id as string,
    kind: action.kind as string,
    payload: (action.payload ?? {}) as Record<string, unknown>,
    external_id: (action.external_id as string | null) ?? null,
    idempotency_key: action.idempotency_key as string,
  });

  if (result.ok) {
    await supabase
      .from("actions_queue")
      .update({ status: "synced", external_id: result.externalId, synced_at: new Date().toISOString() })
      .eq("id", id);
  } else {
    await supabase
      .from("actions_queue")
      .update({ status: "failed", retries: ((action.retries as number) ?? 0) + 1 })
      .eq("id", id);
  }
}
