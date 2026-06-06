import { getAnthropic, MODELS, responseText, extractJson } from "./anthropic";
import { WriterSchema, type Extraction, type WriterOutput } from "./schema";
import type { SettingsContext } from "./extract";

// SPEC.md Section 7: for an `appointment`, generate personalized follow-up drafts
// and coaching from the summary + hooks (NOT the full transcript again — cost
// control). Personal hooks are injected so follow-ups feel personal.

const SYSTEM = `You write follow-ups and quick coaching for a field salesperson
(roofing / doors / exterior, Ontario, Canada). Work ONLY from the structured
summary you are given — do not ask for the transcript.

Return ONLY a JSON object (no prose, no code fences):
{
  "drafts": [
    { "type": "soft|urgency|price|competitor|financing|decision_maker|showroom_invite|last_chance|reactivation",
      "channel": "email|sms", "subject": "", "body": "" }
  ],
  "coach_note": ""
}

Guidance:
- Produce 1 warm email (with a subject) and 1 short SMS unless context calls for
  more. Naturally weave in 1–2 personal_hooks so it feels personal, not templated.
- Address the strongest objection and any competitor concern.
- SMS: no subject (use ""), under ~320 characters, friendly and direct.
- Sign emails with the provided email signature when available.
- coach_note: 1–2 sentences of concrete, kind coaching for next time.`;

export async function writeFollowups(
  data: Extraction,
  settings: SettingsContext,
): Promise<WriterOutput> {
  const anthropic = getAnthropic();

  const brief = JSON.stringify(
    {
      client_name: data.client.name,
      summary: data.summary,
      personal_hooks: data.personal_hooks,
      objections: data.objections,
      competitor: data.competitor,
      decision_maker: data.decision_maker,
      budget_signal: data.budget_signal,
      next_action: data.next_action,
      what_went_well: data.what_went_well,
      what_went_wrong: data.what_went_wrong,
      email_signature: settings.email_signature,
      company_name: settings.company_name,
    },
    null,
    2,
  );

  try {
    const message = await anthropic.messages.create({
      model: MODELS.write,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content: brief }],
    });
    const json = extractJson(responseText(message));
    if (!json) return { drafts: [], coach_note: "" };
    const parsed = WriterSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : { drafts: [], coach_note: "" };
  } catch {
    // Writing is best-effort — if it fails we still keep the extracted analysis.
    return { drafts: [], coach_note: "" };
  }
}
