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

  // Rewrite the name EVERYWHERE in the AI analysis too — summary, coaching, the
  // "what went well / to improve" notes, hooks, etc. (not just the follow-ups).
  const { data: appts } = await supabase
    .from("appointments")
    .select("id, summary, analysis")
    .eq("deal_id", dealId);
  for (const a of appts ?? []) {
    let analysis = a.analysis as unknown;
    if (analysis) {
      try {
        const rewritten = renameIn(JSON.stringify(analysis), oldName, newName);
        if (rewritten) analysis = JSON.parse(rewritten);
      } catch {
        /* keep original analysis if the rewrite would break the JSON */
      }
    }
    await supabase
      .from("appointments")
      .update({ summary: renameIn(a.summary as string | null, oldName, newName), analysis })
      .eq("id", a.id);
  }
}

// Literal (non-regex) replace — for phone numbers / emails written into text.
function replaceLiteral(text: string | null | undefined, oldV: string, newV: string): string | null {
  if (!text) return text ?? null;
  if (!oldV || oldV === newV) return text;
  return text.split(oldV).join(newV);
}

// When the phone/email changes, point every queued follow-up at the NEW contact
// (the email/SMS recipient) and fix any number/address written into the text —
// so "I changed the phone" really does update all the follow-ups.
async function propagateContact(
  dealId: string,
  c: { oldPhone: string | null; newPhone: string | null; oldEmail: string | null; newEmail: string | null },
) {
  const phoneChanged = !!c.newPhone && c.newPhone !== c.oldPhone;
  const emailChanged = !!c.newEmail && c.newEmail !== c.oldEmail;
  if (!phoneChanged && !emailChanged) return;
  const supabase = createAdminClient();

  const { data: acts } = await supabase
    .from("actions_queue")
    .select("id, kind, payload")
    .eq("deal_id", dealId)
    .in("kind", ["email", "sms"]);
  for (const a of acts ?? []) {
    const p = { ...((a.payload as Record<string, unknown>) ?? {}) };
    if (a.kind === "sms" && phoneChanged) p.to = c.newPhone;
    if (a.kind === "email" && emailChanged) p.to = c.newEmail;
    if (phoneChanged && c.oldPhone) p.body = replaceLiteral(p.body as string | null, c.oldPhone, c.newPhone!);
    if (emailChanged && c.oldEmail) {
      p.body = replaceLiteral(p.body as string | null, c.oldEmail, c.newEmail!);
      p.subject = replaceLiteral(p.subject as string | null, c.oldEmail, c.newEmail!);
    }
    await supabase.from("actions_queue").update({ payload: p }).eq("id", a.id);
  }

  const { data: drafts } = await supabase.from("drafts").select("id, subject, body").eq("deal_id", dealId);
  for (const d of drafts ?? []) {
    let body = d.body as string | null;
    let subject = d.subject as string | null;
    if (phoneChanged && c.oldPhone) body = replaceLiteral(body, c.oldPhone, c.newPhone!);
    if (emailChanged && c.oldEmail) {
      body = replaceLiteral(body, c.oldEmail, c.newEmail!);
      subject = replaceLiteral(subject, c.oldEmail, c.newEmail!);
    }
    await supabase.from("drafts").update({ subject, body }).eq("id", d.id);
  }
}

export async function updateDeal(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();

  // Grab the previous contact details so we can propagate any change.
  const { data: prev } = await supabase
    .from("deals")
    .select("client_name, phone, email")
    .eq("id", id)
    .maybeSingle();
  const oldName = (prev?.client_name as string | null) ?? "";
  const newName = str(form, "client_name") ?? "Unnamed";
  const oldPhone = (prev?.phone as string | null) ?? null;
  const oldEmail = (prev?.email as string | null) ?? null;
  const newPhone = str(form, "phone");
  const newEmail = str(form, "email");

  await supabase
    .from("deals")
    .update({
      client_name: newName,
      address: str(form, "address"),
      phone: newPhone,
      email: newEmail,
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

  // Propagate name + contact changes into all follow-ups / drafts / analysis.
  await propagateName(id, oldName, newName);
  await propagateContact(id, { oldPhone, newPhone, oldEmail, newEmail });

  if ((str(form, "status") ?? "new") === "won") await recordWon(supabase, id);

  revalidatePath(`/deals/${id}`);
  revalidatePath(`/deals/${id}/coaching`);
  revalidatePath("/earnings");
  revalidatePath("/deals");
  revalidatePath("/");
  redirect(`/deals/${id}`);
}
