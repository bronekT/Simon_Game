import type { SupabaseClient } from "@supabase/supabase-js";
import { extract, type SettingsContext } from "./ai/extract";
import { writeFollowups } from "./ai/write";
import { safeDraftType, type Draft, type Extraction } from "./ai/schema";
import { chooseMatch, type DealCandidate } from "./match";
import type { DealStatus } from "./types";

export type PipelineResult =
  | { ok: true; dealId: string | null; appointmentId: string; created: boolean; matchedBy: string; recordType: string }
  | { ok: false; appointmentId: string; error: string };

// Step 1 (Ingest) — store the raw transcript immediately and return the row id.
// Split out so the heavy AI work can run in the background (see analyzeAppointment).
export async function ingestTranscript(
  supabase: SupabaseClient,
  userId: string,
  transcript: string,
  attachDealId: string | null,
  source: "manual" | "plaud" = "manual",
): Promise<string | null> {
  const { data, error } = await supabase
    .from("appointments")
    .insert({ user_id: userId, transcript, source, deal_id: attachDealId })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id as string;
}

// SPEC.md Section 6 — the reliable pipeline (ingest + analyze in one go).
export async function runPipeline(
  supabase: SupabaseClient,
  transcript: string,
  attachDealId: string | null,
  userId: string,
  source: "manual" | "plaud" = "manual",
): Promise<PipelineResult> {
  const appointmentId = await ingestTranscript(supabase, userId, transcript, attachDealId, source);
  if (!appointmentId) {
    return { ok: false, appointmentId: "", error: "Could not save transcript." };
  }
  return analyzeAppointment(supabase, userId, appointmentId);
}

// Steps 2–5 — classify, validate, match, branch, persist. Operates on an
// existing appointment row (so it can run after the request, in the background).
export async function analyzeAppointment(
  supabase: SupabaseClient,
  userId: string,
  appointmentId: string,
): Promise<PipelineResult> {
  const { data: row } = await supabase
    .from("appointments")
    .select("transcript, deal_id")
    .eq("id", appointmentId)
    .single();
  const transcript = (row?.transcript as string) ?? "";
  const attachDealId = (row?.deal_id as string | null) ?? null;

  // Settings give the AI company name / showroom / signature for confirmations.
  const { data: settingsRow } = await supabase
    .from("settings")
    .select("company_name, showroom_address, email_signature")
    .eq("user_id", userId)
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
  const isNote = data.record_type === "note";

  // 2 (match). Resolve which deal this belongs to. A pure "note" is just logged:
  // we never create a brand-new deal for it (only attach if it clearly matches).
  const { dealId, created, matchedBy } = await resolveDeal(
    supabase,
    data,
    attachDealId,
    userId,
    !isNote, // createIfMissing
  );

  // 4 (branch by record_type).
  let drafts: Draft[] = isNote ? [] : data.drafts;
  let coachNote = "";
  let coaching: unknown[] = [];
  if (data.record_type === "appointment") {
    // Full analysis path: polished follow-ups + detailed coaching (Sonnet).
    const writer = await writeFollowups(data, settings);
    if (writer.drafts.length > 0) drafts = writer.drafts;
    coachNote = writer.coach_note;
    coaching = writer.coaching;
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
      analysis: { ...data, coach_note: coachNote, coaching },
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

  // A "note" is just logged — no deal changes, no drafts, no queued actions.
  if (isNote || !dealId) {
    return { ok: true, dealId, appointmentId, created, matchedBy, recordType: data.record_type };
  }

  // Update the deal from the analysis.
  await applyDealUpdate(supabase, dealId, data);

  // Persist generated drafts (content the user can read/copy on the deal).
  if (drafts.length > 0) {
    await supabase.from("drafts").insert(
      drafts.map((d) => ({
        user_id: userId,
        deal_id: dealId,
        type: safeDraftType(d.type),
        channel: d.channel,
        subject: d.subject || null,
        body: d.body,
        status: "draft",
      })),
    );
  }

  // 5. Queue actions — everything that MAY leave the system goes into
  // actions_queue as `proposed`. Nothing is sent yet (approval is Phase 2,
  // Google push is Phase 3). Idempotency keys are deterministic so a retry
  // never duplicates.
  await enqueueActions(supabase, {
    userId,
    dealId,
    appointmentId,
    drafts,
    proposedEvent: data.proposed_event,
  });

  return { ok: true, dealId, appointmentId, created, matchedBy, recordType: data.record_type };
}

async function enqueueActions(
  supabase: SupabaseClient,
  args: {
    userId: string;
    dealId: string;
    appointmentId: string;
    drafts: Draft[];
    proposedEvent: Extraction["proposed_event"];
  },
) {
  const { userId, dealId, appointmentId, drafts, proposedEvent } = args;

  const { data: contact } = await supabase
    .from("deals")
    .select("email, phone")
    .eq("id", dealId)
    .single();

  const rows: {
    user_id: string;
    deal_id: string;
    kind: "email" | "sms" | "calendar_event";
    payload: Record<string, unknown>;
    status: string;
    idempotency_key: string;
  }[] = [];

  drafts.forEach((d, i) => {
    const kind = d.channel === "email" ? "email" : "sms";
    const payload =
      kind === "email"
        ? { subject: d.subject ?? "", body: d.body, to: contact?.email ?? null, draft_type: d.type }
        : { body: d.body, to: contact?.phone ?? null, draft_type: d.type };
    rows.push({
      user_id: userId,
      deal_id: dealId,
      kind,
      payload,
      status: "proposed",
      idempotency_key: `${appointmentId}-msg-${i}`,
    });
  });

  if (proposedEvent) {
    rows.push({
      user_id: userId,
      deal_id: dealId,
      kind: "calendar_event",
      payload: {
        title: proposedEvent.title,
        start: proposedEvent.start,
        location: proposedEvent.location ?? "",
        notes: proposedEvent.notes ?? "",
      },
      status: "proposed",
      idempotency_key: `${appointmentId}-event`,
    });
  }

  if (rows.length > 0) {
    // Ignore conflicts so a re-run with the same keys is a no-op.
    await supabase.from("actions_queue").upsert(rows, {
      onConflict: "idempotency_key",
      ignoreDuplicates: true,
    });
  }
}

async function resolveDeal(
  supabase: SupabaseClient,
  data: Extraction,
  attachDealId: string | null,
  userId: string,
  createIfMissing: boolean,
): Promise<{ dealId: string | null; created: boolean; matchedBy: string }> {
  // Human-in-the-loop: an explicit choice always wins.
  if (attachDealId) {
    return { dealId: attachDealId, created: false, matchedBy: "manual" };
  }

  const { data: rows } = await supabase
    .from("deals")
    .select("id, client_name, phone, status, updated_at")
    .eq("user_id", userId);
  const candidates = (rows ?? []) as DealCandidate[];

  const match = chooseMatch(candidates, {
    phone: data.client.phone,
    name: data.client.name,
  });
  if (match.kind === "phone") {
    return { dealId: match.dealId, created: false, matchedBy: "phone" };
  }

  // A note with no match stays unattached — don't spawn a junk deal.
  if (!createIfMissing) {
    return { dealId: null, created: false, matchedBy: "none" };
  }

  // Otherwise create a new deal (never attach on name alone).
  const { data: created } = await supabase
    .from("deals")
    .insert({
      user_id: userId,
      client_name: data.client.name ?? "New lead",
      phone: data.client.phone,
      email: data.client.email,
      address: data.client.address,
      service_type: data.service_type ?? "doors",
      door_type: data.door_type,
      door_count: data.door_count != null ? Math.round(data.door_count) : null,
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
    .select("status, service_type, door_type, door_count, quote_price, client_name, address")
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
  // Fill door details / price from the analysis when we don't already have them.
  if (!current?.door_type && data.door_type) update.door_type = data.door_type;
  if (current?.door_count == null && data.door_count != null) {
    update.door_count = Math.round(data.door_count);
  }
  if (current?.quote_price == null && data.quote_price != null) {
    update.quote_price = data.quote_price;
  }
  // Backfill a real client name / address if we didn't have one yet.
  const placeholder = !current?.client_name || current.client_name === "New lead";
  if (placeholder && data.client.name) update.client_name = data.client.name;
  if (!current?.address && data.client.address) update.address = data.client.address;

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
