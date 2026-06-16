"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { writeFollowups } from "@/lib/ai/write";
import { safeDraftType, type Extraction } from "@/lib/ai/schema";

// Change status right on the deal — no Edit screen needed.
export async function setStatus(form: FormData) {
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!id || !status) return;
  const supabase = await createClient();
  await supabase.from("deals").update({ status }).eq("id", id);
  revalidatePath(`/deals/${id}`);
  revalidatePath("/deals");
  revalidatePath("/");
}

// Follow-up counter +1 / -1 (never below 0).
export async function bumpFollowups(form: FormData) {
  const id = String(form.get("id") ?? "");
  const delta = Number(form.get("delta") ?? "0");
  if (!id) return;
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("followups_count").eq("id", id).maybeSingle();
  const current = (data?.followups_count as number) ?? 0;
  const next = Math.max(0, current + (Number.isFinite(delta) ? delta : 0));
  await supabase.from("deals").update({ followups_count: next }).eq("id", id);
  revalidatePath(`/deals/${id}`);
}

export async function deleteDeal(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("deals").delete().eq("id", id);
  revalidatePath("/deals");
  revalidatePath("/");
  redirect("/deals");
}

// Generate fresh close-oriented follow-ups for this deal on demand (when none
// exist, or you want new ones). Uses the latest appointment's analysis.
export async function generateFollowups(form: FormData) {
  const dealId = String(form.get("id") ?? "");
  if (!dealId) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: appt } = await supabase
    .from("appointments")
    .select("analysis")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!appt?.analysis) {
    redirect(`/deals/${dealId}?error=${encodeURIComponent("Analyze an appointment first, then I can write follow-ups.")}`);
  }

  const { data: deal } = await supabase.from("deals").select("email, phone").eq("id", dealId).single();
  const { data: s } = await supabase
    .from("settings")
    .select("company_name, showroom_address, email_signature")
    .eq("user_id", user.id)
    .maybeSingle();

  const writer = await writeFollowups(appt!.analysis as unknown as Extraction, {
    company_name: s?.company_name ?? null,
    showroom_address: s?.showroom_address ?? null,
    email_signature: s?.email_signature ?? null,
  });
  if (writer.drafts.length === 0) {
    redirect(`/deals/${dealId}?error=${encodeURIComponent("Couldn't generate follow-ups — try again.")}`);
  }

  const stamp = Date.now();
  await supabase.from("drafts").insert(
    writer.drafts.map((d) => ({
      user_id: user.id,
      deal_id: dealId,
      type: safeDraftType(d.type),
      channel: d.channel,
      subject: d.subject || null,
      body: d.body,
      status: "draft",
    })),
  );
  await supabase.from("actions_queue").insert(
    writer.drafts.map((d, i) => ({
      user_id: user.id,
      deal_id: dealId,
      kind: d.channel === "email" ? "email" : "sms",
      payload:
        d.channel === "email"
          ? { subject: d.subject ?? "", body: d.body, to: deal?.email ?? null, draft_type: d.type }
          : { body: d.body, to: deal?.phone ?? null, draft_type: d.type },
      status: "proposed",
      idempotency_key: `gen-${dealId}-${stamp}-${i}`,
    })),
  );

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/approve");
  redirect(`/deals/${dealId}?analyzed=1`);
}

