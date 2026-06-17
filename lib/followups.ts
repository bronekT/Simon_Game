import type { SupabaseClient } from "@supabase/supabase-js";
import { writeFollowups } from "./ai/write";
import { safeDraftType, type Extraction } from "./ai/schema";

// Generate polished follow-ups + detailed coaching for a deal, from its latest
// appointment analysis, and persist them (drafts + queued actions + coaching).
// Run as its OWN step (one AI call) so it never competes with extraction for the
// 60s function budget — this is what makes long meetings reliable.
export async function produceFollowups(
  supabase: SupabaseClient,
  userId: string,
  dealId: string,
): Promise<{ ok: boolean; count: number }> {
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, analysis")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!appt?.analysis) return { ok: false, count: 0 };
  const analysis = appt.analysis as Record<string, unknown>;

  const { data: deal } = await supabase
    .from("deals")
    .select("email, phone")
    .eq("id", dealId)
    .single();
  const { data: s } = await supabase
    .from("settings")
    .select("company_name, showroom_address, email_signature")
    .eq("user_id", userId)
    .maybeSingle();

  const writer = await writeFollowups(analysis as unknown as Extraction, {
    company_name: s?.company_name ?? null,
    showroom_address: s?.showroom_address ?? null,
    email_signature: s?.email_signature ?? null,
  });
  if (writer.drafts.length === 0 && !writer.coach_note && writer.coaching.length === 0) {
    return { ok: false, count: 0 };
  }

  // Persist coaching back onto the appointment analysis.
  await supabase
    .from("appointments")
    .update({ analysis: { ...analysis, coach_note: writer.coach_note, coaching: writer.coaching } })
    .eq("id", appt.id);

  if (writer.drafts.length > 0) {
    await supabase.from("drafts").insert(
      writer.drafts.map((d) => ({
        user_id: userId,
        deal_id: dealId,
        type: safeDraftType(d.type),
        channel: d.channel,
        subject: d.subject || null,
        body: d.body,
        status: "draft",
      })),
    );
    const stamp = Date.now();
    await supabase.from("actions_queue").upsert(
      writer.drafts.map((d, i) => ({
        user_id: userId,
        deal_id: dealId,
        kind: d.channel === "email" ? "email" : "sms",
        payload:
          d.channel === "email"
            ? { subject: d.subject ?? "", body: d.body, to: deal?.email ?? null, draft_type: d.type }
            : { body: d.body, to: deal?.phone ?? null, draft_type: d.type },
        status: "proposed",
        idempotency_key: `fu-${dealId}-${stamp}-${i}`,
      })),
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    );
  }

  return { ok: true, count: writer.drafts.length };
}
