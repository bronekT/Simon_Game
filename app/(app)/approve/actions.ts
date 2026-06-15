"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Save edits + approve a queued action. In Phase 2 this only flips the status to
// `approved` (nothing leaves the system). Phase 3 adds the Google push on top.
export async function approveAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  const kind = String(form.get("kind") ?? "");
  if (!id) return;

  // Rebuild the payload from the edited fields, by kind.
  let payload: Record<string, unknown> = {};
  if (kind === "email") {
    payload = {
      subject: str(form, "subject"),
      body: str(form, "body"),
      to: str(form, "to"),
    };
  } else if (kind === "sms") {
    payload = { body: str(form, "body"), to: str(form, "to") };
  } else if (kind === "calendar_event") {
    payload = {
      title: str(form, "title"),
      start: str(form, "start"),
      location: str(form, "location"),
      notes: str(form, "notes"),
    };
  }

  const supabase = await createClient();
  await supabase
    .from("actions_queue")
    .update({ payload, status: "approved" })
    .eq("id", id);

  revalidatePath("/approve");
}

// Save edits without approving (keep it in the queue as `proposed`).
export async function saveAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  const kind = String(form.get("kind") ?? "");
  if (!id) return;

  let payload: Record<string, unknown> = {};
  if (kind === "email") {
    payload = { subject: str(form, "subject"), body: str(form, "body"), to: str(form, "to") };
  } else if (kind === "sms") {
    payload = { body: str(form, "body"), to: str(form, "to") };
  } else if (kind === "calendar_event") {
    payload = {
      title: str(form, "title"),
      start: str(form, "start"),
      location: str(form, "location"),
      notes: str(form, "notes"),
    };
  }

  const supabase = await createClient();
  await supabase.from("actions_queue").update({ payload }).eq("id", id);
  revalidatePath("/approve");
}

export async function dismissAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("actions_queue").update({ status: "dismissed" }).eq("id", id);
  revalidatePath("/approve");
}

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}
