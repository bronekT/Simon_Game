import type { SupabaseClient } from "@supabase/supabase-js";
import { extract, type SettingsContext } from "./ai/extract";
import { writeFollowups } from "./ai/write";
import { safeDraftType, type Draft, type Extraction } from "./ai/schema";
import { chooseMatch, type DealCandidate } from "./match";
import type { DealStatus } from "./types";

export type PipelineResult =
  | { ok: true; dealId: string; appointmentId: string; created: boolean; matchedBy: string }
  | { ok: false; appointmentId: string; error: string };

// SPEC.md Section 6 — the reliable pipeline. Phase 1 runs steps 1–4 (ingest,
// classify+match, validate, branch) and writes analysis + drafts. Queuing to
// actions_queue and Google push come in Phases 2–3.
export async function runPipeline(
  supabase: SupabaseClient,
  transcript: string,
  attachDealId: string | null,
): Promise<PipelineResult> {
  // 1. Ingest — store the raw transcript on an appointments row first.
  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .insert({ transcript, source: "manual", deal_id: attachDealId })
    .select("id")
    .single();
  if (apptErr || !appt) {
    return { ok: false, appointmentId: "", error: apptErr?.message ?? "Could not save transcript." };
  }
  const appointmentId = appt.id as string;

  // Settings give the AI company name / showroom / signature for confirmations.
  const { data: settingsRow } = await supabase
    .from("settings")
    .select("company_name, showroom_address, email_signature")
    .maybeSingle();
  const settings: SettingsContext = {
    company_name: settingsRow?.company_name ?? null,
    showroom_address: settingsRow?.showroom_address ?? null,
    email_signature: settingsRow?.email_signature ?? null,
  };

  // 2–3. Classify + validate.
  const result = await extract(transcript, settings);
  if (!result.ok) {
    await supabase
      .from("appointments")
      .update({ needs_review: true })
      .eq("id", appointmentId);
    return { ok: false, appointmentId, error: result.error };
  }
  const data = result.data;

  // 2 (match). Resolve which deal this belongs to.
  const { dealId, created, matchedBy } = await resolveDeal(
    supabase,
    data,
    attachDealId,
  );

  // 4 (branch). Polished drafts + coaching for appointments (Sonnet).
  let drafts: Draft[] = data.drafts;
  let coachNote = "";
  if (data.record_type === "appointment") {
    const writer = await writeFollowups(data, settings);
    if (writer.drafts.length > 0) drafts = writer.drafts;
    coachNote = writer.coach_note;
  }
  if (data.record_type === "booking_call" && data.confirmation_sms) {
    drafts = [
      { type: "confirmation", channel: "sms", subject: "", body: data.confirmation_sms },
      ...drafts,
    ];
  }

  // Persist analysis onto the appointment.
  await supabase
    .from("appointments")
    .update({
      deal_id: dealId,
      record_type: data.record_type,
      location_type: data.location_type,
      occurred_at: data.proposed_event?.start ?? new Date().toISOString(),
      summary: data.summary,
      analysis: { ...data, coach_note: coachNote },
      talk_ratio: Math.round(data.talk_ratio),
      sentiment: data.sentiment,
      score_rapport: Math.round(data.scores.rapport),
      score_discovery: Math.round(data.scores.discovery),
      score_pain: Math.round(data.scores.pain),
      score_product: Math.round(data.scores.product),
      score_objection: Math.round(data.scores.objection),
      score_closing: Math.round(data.scores.closing),
      score_followup: Math.round(data.scores.followup),
      personal_hooks: data.personal_hooks,
      needs_review: false,
    })
    .eq("id", appointmentId);

  // Update the deal from the analysis.
  await applyDealUpdate(supabase, dealId, data);

  // Persist generated drafts.
  if (drafts.length > 0) {
    await supabase.from("drafts").insert(
      drafts.map((d) => ({
        deal_id: dealId,
        type: safeDraftType(d.type),
        channel: d.channel,
        subject: d.subject || null,
        body: d.body,
        status: "draft",
      })),
    );
  }

  return { ok: true, dealId, appointmentId, created, matchedBy };
}

async function resolveDeal(
  supabase: SupabaseClient,
  data: Extraction,
  attachDealId: string | null,
): Promise<{ dealId: string; created: boolean; matchedBy: string }> {
  // Human-in-the-loop: an explicit choice always wins.
  if (attachDealId) {
    return { dealId: attachDealId, created: false, matchedBy: "manual" };
  }

  const { data: rows } = await supabase
    .from("deals")
    .select("id, client_name, phone, status, updated_at");
  const candidates = (rows ?? []) as DealCandidate[];

  const match = chooseMatch(candidates, {
    phone: data.client.phone,
    name: data.client.name,
  });
  if (match.kind === "phone") {
    return { dealId: match.dealId, created: false, matchedBy: "phone" };
  }

  // Otherwise create a new deal (never attach on name alone).
  const { data: created } = await supabase
    .from("deals")
    .insert({
      client_name: data.client.name ?? "New lead",
      phone: data.client.phone,
      email: data.client.email,
      address: data.client.address,
      service_type: data.service_type,
      status: "new",
    })
    .select("id")
    .single();

  return { dealId: created!.id as string, created: true, matchedBy: "new" };
}

async function applyDealUpdate(
  supabase: SupabaseClient,
  dealId: string,
  data: Extraction,
) {
  const { data: current } = await supabase
    .from("deals")
    .select("status, service_type")
    .eq("id", dealId)
    .single();

  const update: Record<string, unknown> = {
    next_action: data.next_action || null,
    followup_at: data.followup_at,
    competitor: data.competitor,
    decision_maker: data.decision_maker,
    main_objection: data.objections[0] ?? null,
    probability: clamp(Math.round(data.close_probability), 0, 100),
    status: nextStatus(data.record_type, current?.status as DealStatus),
  };
  if (!current?.service_type && data.service_type) {
    update.service_type = data.service_type;
  }

  await supabase.from("deals").update(update).eq("id", dealId);
}

// Advance the deal's stage based on what kind of contact this was — but never
// move a deal backwards or out of a closed state.
function nextStatus(
  record: Extraction["record_type"],
  current: DealStatus | undefined,
): DealStatus {
  const cur = current ?? "new";
  if (["won", "lost", "dead"].includes(cur)) return cur;
  const target: Record<string, DealStatus> = {
    booking_call: "booked",
    appointment: "met",
    followup_call: "negotiation",
    note: cur,
  };
  const t = target[record] ?? cur;
  return rank(t) > rank(cur) ? t : cur;
}

const ORDER: DealStatus[] = [
  "new", "booked", "met", "quoted", "negotiation", "won", "lost", "dead",
];
function rank(s: DealStatus): number {
  return ORDER.indexOf(s);
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
