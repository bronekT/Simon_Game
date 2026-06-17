"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordWon } from "@/lib/won";
import { fromLocalInput } from "@/lib/format";

function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}
function num(form: FormData, key: string): number | null {
  const v = str(form, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Replace every occurrence of the old name (full name AND first name) with the
// new one, as whole words, case-insensitive. Deterministic — no AI.
function renameIn(text: string | null | undefined, oldName: string, newName: string): string | null {
  if (!text) return text ?? null;
  let out = text;
  const oldFirst = oldName.split(/\s+/)[0];
  const newFirst = newName.split(/\s+/)[0];
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (oldName && oldName !== newName) {
    out = out.replace(new RegExp(`\\b${esc(oldName)}\\b`, "gi"), newName);
  }
  if (oldFirst && oldFirst.toLowerCase() !== newFirst.toLowerCase()) {
    out = out.replace(new RegExp(`\\b${esc(oldFirst)}\\b`, "gi"), newFirst);
  }
  return out;
}

// When the deal is renamed, rewrite the name inside its drafts + queued actions
// so follow-ups always greet the right person. Uses the service-role client so
// the rewrite can never be silently blocked.
async function propagateName(
  dealId: string,
  oldName: string,
  newName: string,
) {
  if (!oldName || oldName === newName) return;
  const supabase = createAdminClient();

  const { data: drafts } = await supabase
    .from("drafts")
    .select("id, subject, body")
    .eq("deal_id", dealId);
  for (const d of drafts ?? []) {
    await supabase
      .from("drafts")
      .update({
        subject: renameIn(d.subject as string | null, oldName, newName),
        body: renameIn(d.body as string | null, oldName, newName),
      })
      .eq("id", d.id);
  }

  const { data: acts } = await supabase
    .from("actions_queue")
    .select("id, payload")
    .eq("deal_id", dealId)
    .in("kind", ["email", "sms"]);
  for (const a of acts ?? []) {
    const p = (a.payload ?? {}) as Record<string, unknown>;
    await supabase
      .from("actions_queue")
      .update({
        payload: {
          ...p,
          subject: renameIn(p.subject as string | null, oldName, newName),
          body: renameIn(p.body as string | null, oldName, newName),
        },
      })
      .eq("id", a.id);
  }
}

export async function updateDeal(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();

  // Grab the previous name first so we can propagate a rename to follow-ups.
  const { data: prev } = await supabase.from("deals").select("client_name").eq("id", id).maybeSingle();
  const oldName = (prev?.client_name as string | null) ?? "";
  const newName = str(form, "client_name") ?? "Unnamed";

  await supabase
    .from("deals")
    .update({
      client_name: newName,
      address: str(form, "address"),
      phone: str(form, "phone"),
      email: str(form, "email"),
      door_type: str(form, "door_type"),
      door_count: num(form, "door_count"),
      status: str(form, "status") ?? "new",
      location_type: str(form, "location_type"),
      quote_price: num(form, "quote_price"),
      commission: num(form, "commission"),
      probability: num(form, "probability"),
      decision_maker: str(form, "decision_maker"),
      competitor: str(form, "competitor"),
      main_objection: str(form, "main_objection"),
      next_action: str(form, "next_action"),
      followup_at: fromLocalInput(str(form, "followup_at")),
    })
    .eq("id", id);

  // Rename inside drafts + queued follow-ups so they greet the right person.
  await propagateName(id, oldName, newName);

  if ((str(form, "status") ?? "new") === "won") await recordWon(supabase, id);

  revalidatePath(`/deals/${id}`);
  revalidatePath("/earnings");
  revalidatePath("/deals");
  revalidatePath("/");
  redirect(`/deals/${id}`);
}
