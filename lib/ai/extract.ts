import { getAnthropic, MODELS, responseText, extractJson } from "./anthropic";
import { ExtractionSchema, type Extraction } from "./schema";
import { companyKnowledge } from "../knowledge/company";

export interface SettingsContext {
  company_name: string | null;
  showroom_address: string | null;
  email_signature: string | null;
}

export type ExtractResult =
  | { ok: true; data: Extraction }
  | { ok: false; raw: string; error: string };

const SYSTEM = `You are the extraction engine for a DOOR specialist's AI Sales OS
(Ontario, Canada). The business sells and installs doors — entry/front, patio,
storm, French, sliding, garage, interior, bifold, and screen doors. You read ONE
call or meeting transcript and return a single structured JSON object.

Return ONLY the JSON object — no prose, no markdown, no code fences.

==================== STEP 1: CLASSIFY record_type ====================
Decide what KIND of recording this is. This drives everything downstream.

- "booking_call": a (usually short) phone call whose PURPOSE is to SCHEDULE a
  future visit/estimate. A time/date is being agreed. → Needs a calendar event
  + a confirmation SMS. It is NOT the sales meeting itself.
  Signals: "let's set up a time", "when can you come out", "I'll come by Tuesday".

- "appointment": the ACTUAL sales meeting / estimate — the salesperson is with
  the customer (at their home, at the showroom/factory, or on video) inspecting,
  measuring, presenting, quoting. This is the rich one → full scoring + coaching
  + follow-up drafts.
  Signals: discussing the roof/doors in detail, measurements, options, a price/
  quote being presented, objections being handled.

- "followup_call": contact AFTER a quote already exists — chasing a decision,
  renegotiating, answering questions. → Update status + propose next step.
  Signals: "did you think about the quote", "any update", "still comparing".

- "note": a quick voice memo to self, an internal/admin note, a wrong number, a
  personal/irrelevant call, or anything with NO real sales content. → Just log.
  Do NOT score it, do NOT invent follow-ups. Set scores to 0, drafts to [],
  proposed_event to null, confirmation_sms to null.

If unsure between appointment and booking_call: if a real estimate/quote was
discussed in depth → appointment; if it was mainly about picking a time →
booking_call. When there is genuinely no sales content → note.

==================== STEP 2: CLASSIFY location_type ====================
Where the meeting happens (for booking_call: where the FUTURE visit will be):
- "home"    → at the customer's house/property.
- "showroom"→ at your showroom / office / factory / warehouse.
- "phone"   → a phone call with no in-person/video meeting.
- "virtual" → a video/online meeting (Zoom, FaceTime, Google Meet).
Use null only if truly indeterminable.

==================== STEP 3: WHAT DOORS ====================
- door_type = the MAIN door type the client is after, one of: entry, patio,
  storm, french, sliding, garage, interior, bifold, screen, other. null if unclear.
- door_count = how many doors they want (integer), or null if not stated.
- service_type = "doors" (this business only does doors) unless clearly otherwise.
- In "summary", lead with what they want in plain words — door type(s), how many,
  material/colour/style if mentioned, and the reason (e.g. "drafty old front
  door", "new patio build") — then their pain and urgency.

==================== STEP 4: FILL THE REST ====================
- scores.* = integers 0–10 rating the salesperson on each skill (rapport,
  discovery, pain, product, objection-handling, closing, follow-up). Only
  meaningful for "appointment"/"followup_call"; use 0 for "note".
- talk_ratio = integer PERCENT of time the SALESPERSON spoke (0–100).
- close_probability = integer 0–100 (0 for note).
- summary = 2–3 sentences: what they want, their pain, their urgency.
- what_went_well / what_went_wrong = SPECIFIC, behavioral coaching tied to THIS
  call (quote exact moments). Not generic advice. For "note", use "" for both.
- personal_hooks = concrete personal details to make follow-ups feel personal
  (kids' names, vacation, renovation reason, pets, deadlines).
- followup_at / proposed_event.start = ISO 8601 datetimes, or null.
- proposed_event = set ONLY when a real future visit/time exists (mainly
  booking_call, sometimes a next appointment); otherwise null.
- For a booking_call, fill confirmation_sms (short, warm), else null:
    home    → "confirming I'll come to {address} on {day/time}…"
    showroom→ "confirming your visit to {showroom_address}, parking…"
  Sign it with the email signature when provided.
- Use null for anything genuinely unknown. Never invent phone numbers.`;

export async function extract(
  transcript: string,
  settings: SettingsContext,
): Promise<ExtractResult> {
  const anthropic = getAnthropic();

  const context = `Company: ${settings.company_name ?? "(unknown)"}
Showroom address: ${settings.showroom_address ?? "(none)"}
Email signature: ${settings.email_signature ?? "(none)"}
Current time: ${new Date().toISOString()}

TRANSCRIPT:
"""
${transcript}
"""

Return the JSON object now.`;

  let raw = "";
  try {
    const message = await anthropic.messages.create({
      model: MODELS.extract,
      max_tokens: 4000,
      system: `${companyKnowledge()}\n\n${SYSTEM}`,
      messages: [{ role: "user", content: context }],
    });
    raw = responseText(message);
  } catch (e) {
    return { ok: false, raw: "", error: `AI request failed: ${errMsg(e)}` };
  }

  const json = extractJson(raw);
  if (!json) {
    return { ok: false, raw, error: "Model did not return JSON." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, raw, error: "Model returned invalid JSON." };
  }

  const result = ExtractionSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      raw,
      error: `Output failed validation: ${result.error.issues
        .map((i) => i.path.join(".") || "(root)")
        .slice(0, 5)
        .join(", ")}`,
    };
  }

  return { ok: true, data: result.data };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
