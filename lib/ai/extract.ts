import { getAnthropic, MODELS, responseText, extractJson } from "./anthropic";
import { ExtractionSchema, type Extraction } from "./schema";

export interface SettingsContext {
  company_name: string | null;
  showroom_address: string | null;
  email_signature: string | null;
}

export type ExtractResult =
  | { ok: true; data: Extraction }
  | { ok: false; raw: string; error: string };

const SYSTEM = `You are the extraction engine for a field salesperson's AI Sales OS
(roofing / doors / exterior, Ontario, Canada). You read ONE call or meeting
transcript and return a single structured JSON object.

Return ONLY the JSON object — no prose, no markdown, no code fences.

Rules:
- record_type: "booking_call" (scheduling a first visit), "appointment" (the
  sales visit itself), "followup_call" (checking in after a quote), or "note".
- scores.* are integers 0–10 rating the salesperson on each skill.
- talk_ratio is the integer PERCENT of time the SALESPERSON spoke (0–100).
- close_probability is an integer 0–100.
- summary: 2–3 sentences on what the client wants, their pain, and urgency.
- personal_hooks: personal details usable to make follow-ups feel personal.
- followup_at / proposed_event.start: ISO 8601 datetimes, or null if none.
- For a booking_call, fill confirmation_sms (short, warm), otherwise null:
    home    → "confirming I'll come to {address} on {day/time}…"
    showroom→ "confirming your showroom visit at {showroom_address}, parking…"
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
      system: SYSTEM,
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
