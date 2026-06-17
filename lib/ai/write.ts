import { getAnthropic, MODELS, responseText, extractJson } from "./anthropic";
import { WriterSchema, type Extraction, type WriterOutput } from "./schema";
import type { SettingsContext } from "./extract";
import { companyKnowledge } from "../knowledge/company";

// SPEC.md Section 7: for an `appointment`, generate personalized follow-up drafts
// and coaching from the summary + hooks (NOT the full transcript again — cost
// control). Personal hooks are injected so follow-ups feel personal.

const SYSTEM = `You write follow-ups and quick coaching for a DOOR specialist's
salesperson (entry, patio, storm, French, sliding, garage, interior doors;
Ontario, Canada). Work ONLY from the structured summary you are given — do not
ask for the transcript. Reference the specific door type(s) and quantity.

Return ONLY a JSON object (no prose, no code fences):
{
  "drafts": [
    { "type": "soft|urgency|price|competitor|financing|decision_maker|showroom_invite|last_chance|reactivation",
      "channel": "email|sms", "subject": "", "body": "" }
  ],
  "coach_note": "",
  "coaching": [
    { "situation": "what happened / what the client said",
      "better": "the exact words to say instead (a real sentence they can use)",
      "technique": "name of the sales technique" }
  ]
}

Guidance for "coaching" (3–5 points, this is the most valuable part):
- Be specific to THIS call. For each point: name the moment, then give the exact
  better phrasing in quotes the salesperson could say next time, and the technique
  (e.g. "anchor high", "feel-felt-found", "assumptive close", "tie-down question",
  "label the objection", "future pacing"). Make it practical and teachable.

Guidance for drafts/coach_note:
- GOAL: CLOSE the customer. Every follow-up should move them to a yes — create
  gentle urgency, offer a small incentive (e.g. "I can hold a 5% spring discount
  if we lock it in this week" / "free upgraded glass if you decide by Friday"),
  OR add value (warranty, lead time, financing) — whichever best fits this deal.
  Always end with a clear, low-friction call to action (book the install, reply
  yes, pick a time). Be warm, not pushy.
- Produce 1 email (with a subject) and 1 short SMS unless context calls for more.
  Naturally weave in 1–2 personal_hooks so it feels personal, not templated.
- Address the strongest objection and any competitor concern head-on.
- SMS: no subject (use ""), under ~320 characters, friendly and direct.
- Sign emails with the provided email signature when available.
- coach_note: concrete, kind, SPECIFIC coaching for next time. Write 2–3 short
  lines, each a single actionable point tied to THIS call (e.g. "You jumped to
  price before establishing value — next time, anchor the warranty first."). No
  generic platitudes. If the call clearly went well, still give one sharpening
  tip. Keep it encouraging.`;

// Reactivation draft for a dead lead (SPEC.md Phase 5). AI-written when a key is
// present, otherwise a sensible template so automations work without AI.
export async function writeReactivation(
  deal: { client_name: string | null; door_type: string | null; main_objection: string | null },
  settings: SettingsContext,
): Promise<{ subject: string; body: string }> {
  const name = deal.client_name ?? "there";
  const sig = settings.email_signature ?? settings.company_name ?? "";
  const what = deal.door_type ? `${deal.door_type} doors` : "new doors";
  const fallback = {
    subject: `Still thinking about your ${what}?`,
    body: `Hi ${name},\n\nIt's been a while since we last spoke about your ${what}. Pricing and lead times have changed, so I'd be happy to take a fresh look and re-quote whenever you're ready — no pressure.\n\nWould a quick call this week work?\n\n${sig}`,
  };

  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  try {
    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: MODELS.write,
      max_tokens: 800,
      system:
        `${companyKnowledge()}\n\n` +
        "You write a single short, warm reactivation email to a lapsed door-sales lead. Return ONLY JSON: {\"subject\":\"\",\"body\":\"\"}. No pressure, reference the door type if known, offer a fresh look/quote, end with a soft question. Sign with the signature if provided.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            client_name: deal.client_name,
            door_type: deal.door_type,
            past_objection: deal.main_objection,
            email_signature: settings.email_signature,
            company_name: settings.company_name,
          }),
        },
      ],
    });
    const json = extractJson(responseText(message));
    if (!json) return fallback;
    const parsed = JSON.parse(json);
    if (typeof parsed.subject === "string" && typeof parsed.body === "string") {
      return { subject: parsed.subject, body: parsed.body };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

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
      max_tokens: 2200,
      system: `${companyKnowledge()}\n\n${SYSTEM}`,
      messages: [{ role: "user", content: brief }],
    });
    const json = extractJson(responseText(message));
    if (!json) return { drafts: [], coach_note: "", coaching: [] };
    const parsed = WriterSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : { drafts: [], coach_note: "", coaching: [] };
  } catch {
    // Writing is best-effort — if it fails we still keep the extracted analysis.
    return { drafts: [], coach_note: "", coaching: [] };
  }
}
