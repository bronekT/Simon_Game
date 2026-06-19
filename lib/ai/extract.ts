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

Read the ENTIRE transcript carefully from start to finish — names, addresses, and
especially the agreed meeting time often appear in the last few lines. Do not stop
early. Then return ONLY the JSON object — no prose, no markdown, no code fences.

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

==================== STEP 3: WHO + WHAT DOORS ====================
- client.name = the CUSTOMER's name. LOOK HARD for it anywhere: a greeting
  ("Hi, this is John", "It's Maria"), the salesperson addressing them ("Thanks
  Maria", "Nice to meet you, Mr. Smith"), a callback name, a signature, or
  contact details. Use at least the first name. It is NOT the salesperson (the
  one selling/measuring/quoting). If a name truly never appears, use null — never
  invent one, and never use the salesperson's name.
  IMPORTANT — the name is OFTEN stated up front (the rep introducing the client,
  or "I'm here with ___"). If the rep EXPLICITLY states or corrects the name
  (e.g. "his name is Karl, not Dan", "it's Karl with a K"), that correction is
  authoritative — use the corrected name and ignore the earlier/wrong one. When
  two names appear, prefer the one the rep clearly attaches to the CUSTOMER.
- client.address = the customer's address if stated anywhere (even partial, e.g.
  "12 Oak Street" or just the street), copied EXACTLY — re-read the street NUMBER,
  street name, and city/town and make sure each matches the words; else null.
  Don't invent or auto-complete.
- client.phone = the customer's phone number if stated, copied DIGIT-FOR-DIGIT
  exactly as spoken. Re-read every digit; keep all of them; never guess or
  complete missing digits. else null.
- door_type = the MAIN door type the client is after, one of: entry, patio,
  storm, french, sliding, garage, interior, bifold, screen, other. null if unclear.
- door_count = how many doors they want (integer), or null if not stated.
- quote_price = the FINAL price the SALESPERSON quoted for the job — the LAST firm
  number they landed on, in CAD. A call can contain MANY numbers: the customer's
  budget, early ballparks, ranges, per-door prices, add-ons, discounts. IGNORE all
  of those — you want the rep's LAST concrete quoted price for the work.
  • Scan from the END of the transcript BACKWARD and take the most recent firm
    price the rep gave/agreed. "around eight grand"/"eight thousand" → 8000;
    "$3,500" → 3500.
  • If it stayed a RANGE ("between 7 and 9 thousand"), use the most recent specific
    figure; if only a range exists, use its UPPER number.
  • NEVER use the customer's stated budget or a competitor's price as quote_price.
  null only if NO price for the job was ever stated.
- service_type = "doors" (this business only does doors) unless clearly otherwise.
- In "summary", lead with what they want in plain words — door type(s), how many,
  material/colour/style if mentioned, and the reason — then their pain and urgency.

==================== OUTCOME ====================
- outcome = "won" if the customer clearly committed/bought/signed/paid or said
  yes to proceed; "lost" if they clearly went with a competitor, cancelled, or
  declined. Otherwise null. (This moves the deal to Won/Lost.)

==================== TIMING — meeting_when is the SOURCE OF TRUTH ====================
This is the single most important field to get right. DO NOT do any date
arithmetic yourself (you are bad at it). Instead, transcribe the spoken time into
ATOMIC PARTS and let our system compute the exact calendar date deterministically.

Whenever a future meeting/visit time is mentioned, agreed, or requested, fill
"meeting_when" with the time EXACTLY AS SPOKEN — do not convert, do not shift:
  meeting_when: {
    "weekday":  one of monday|tuesday|wednesday|thursday|friday|saturday|sunday
                if a weekday is named, else null,
    "relative": "today" or "tomorrow" if said (not a weekday), else null,
    "qualifier":"this" or "next" if said (e.g. "next Friday" → "next"), else null,
    "month":    1-12 ONLY if an explicit calendar month is given (e.g. "June 18"),
    "day":      1-31 ONLY if an explicit day-of-month is given,
    "hour":     the hour number spoken (1-12), else null,
    "minute":   minutes 0-59 (use 0 if an hour was given with no minutes), else null,
    "meridiem": "am" or "pm" if stated or clearly implied, else null
  }
EXAMPLES (copy this behavior exactly):
  "Thursday at 7pm"     → {"weekday":"thursday","qualifier":null,"relative":null,"month":null,"day":null,"hour":7,"minute":0,"meridiem":"pm"}
  "next Monday at 5"    → {"weekday":"monday","qualifier":"next","relative":null,"month":null,"day":null,"hour":5,"minute":0,"meridiem":null}
  "tomorrow at 9:30am"  → {"weekday":null,"qualifier":null,"relative":"tomorrow","month":null,"day":null,"hour":9,"minute":30,"meridiem":"am"}
  "June 18th at 2pm"    → {"weekday":null,"qualifier":null,"relative":null,"month":6,"day":18,"hour":2,"minute":0,"meridiem":"pm"}
RE-CHECK before you answer: read the time phrase in the transcript again and make
sure the weekday/hour/meridiem in meeting_when match the words EXACTLY. If no
future time is discussed at all, set meeting_when to null.

Then, as a best-effort secondary copy (our system will RECOMPUTE and override the
real date from meeting_when, so do not stress the arithmetic):
- A DATE REFERENCE table (America/Toronto) is in the user message — use it to fill
  proposed_event.start as ISO 8601 WITH the Toronto offset (e.g.
  2026-06-18T19:00:00-04:00). Never output bare/naive times.
- proposed_event = set whenever a specific meeting/visit time is agreed OR
  requested — even a quick "book me Thursday at 9" counts. Fill title, start,
  location, notes. (start will be replaced by the resolver — meeting_when wins.)
- followup_at = when the NEXT touch should realistically happen (usually 1–7 days
  out) unless a specific date was asked. ISO 8601 w/ offset, or null.

==================== STEP 4: FILL THE REST ====================
- scores = an object with EXACTLY these 7 integer keys (0–10). Score the SKILL the
  salesperson SHOWED. Do NOT default any score to 0 — give a real rating. Only use
  0 for a "note", or for a skill that was genuinely never used at all.
  {
    "rapport":   building trust / connection / likeability,
    "discovery": asking good questions to understand needs & situation,
    "pain":      surfacing the real problem, urgency, the cost of not buying,
    "product":   presenting the doors / options / value clearly,
    "objection": handling pushback (price, timeline, spouse, competitor, "let me
                 think"). IMPORTANT: if NO objection arose, rate how well they
                 PRE-EMPTED concerns — usually 5–7, NOT 0.
    "closing":   asking for the sale / commitment / a decision,
    "followup":  securing the NEXT STEP — locking the next meeting or decision,
                 creating urgency to continue, getting commitment to proceed.
                 IMPORTANT: in an appointment this is about closing the loop to
                 the next step — rate it properly, NOT 0.
  }
  objection and followup must reflect the rep's skill even when the event was
  light — they should almost never be 0 on a real call.
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
- Use null for anything genuinely unknown. Never invent phone numbers.

==================== FINAL VERIFICATION (do this before you answer) ====================
Before returning, RE-READ the transcript and double-check these critical fields a
second time. They must match the words exactly — accuracy here matters most:
1. DATE/TIME (most important): re-read the exact phrase where the time is agreed.
   Confirm meeting_when.weekday / relative / month+day, hour, minute and meridiem
   all match the spoken words. If the rep said a weekday, the weekday must be that
   weekday. If anything is unsure, re-read that line again.
2. PRICE: confirm quote_price is the LAST firm price the rep quoted — not a budget,
   a range, a per-door figure, or an earlier ballpark. Re-scan from the end.
3. NAME: confirm it's the CUSTOMER (not the rep), and that any explicit correction
   ("his name is Karl, not Dan") was applied.
4. PHONE: re-read it digit by digit — every digit present and correct.
5. ADDRESS: re-read the street number, street, and city — all exactly as said.
Only after this check, output the JSON. If two readings disagree, trust the
clearest explicit statement; if still unsure, use null rather than guessing.`;

export async function extract(
  transcript: string,
  settings: SettingsContext,
): Promise<ExtractResult> {
  const anthropic = getAnthropic();

  // Read the WHOLE meeting — 1–3 hour recordings are normal. Claude prefills huge
  // inputs in seconds (the cost is output tokens, not input length), so even a
  // multi-hour transcript extracts in well under a minute. We only trim in the
  // extreme case where it would exceed the model's context window.
  transcript = boundTranscript(transcript);

  const context = `Company: ${settings.company_name ?? "(unknown)"}
Showroom address: ${settings.showroom_address ?? "(none)"}
Email signature: ${settings.email_signature ?? "(none)"}

${dateReference()}

TRANSCRIPT:
"""
${transcript}
"""

Return the JSON object now.`;

  let raw = "";
  try {
    const message = await anthropic.messages.create({
      model: MODELS.extract,
      max_tokens: 2000,
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

// Only guard against exceeding the model's context window (~200k tokens). A
// 1–3 hour meeting (~35–80k tokens) passes through UNTOUCHED and is read in full.
// Past the ceiling (~8+ hours of speech) we keep the head + tail, which hold the
// name, the doors, and the agreed meeting time.
function boundTranscript(t: string): string {
  const MAX = 560_000; // chars (~140k tokens) — leaves headroom under the 200k window
  if (t.length <= MAX) return t;
  const head = t.slice(0, 400_000);
  const tail = t.slice(-120_000);
  return `${head}\n\n…[middle of a very long recording trimmed to fit]…\n\n${tail}`;
}

// A concrete date table in the business's timezone (Ontario / America/Toronto)
// so the model can resolve "Thursday 7pm" to the EXACT date — its weakest spot.
function dateReference(): string {
  const tz = "America/Toronto";
  const now = new Date();

  const partsFor = (d: Date) => {
    const f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, weekday: "long", year: "numeric", month: "2-digit", day: "2-digit",
    });
    const p: Record<string, string> = {};
    for (const part of f.formatToParts(d)) p[part.type] = part.value;
    return { weekday: p.weekday, date: `${p.year}-${p.month}-${p.day}` };
  };

  const time = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(now);

  // Toronto offset like "GMT-4" → "-04:00".
  const tzName = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
    .formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "GMT-4";
  const m = tzName.match(/GMT([+-])(\d{1,2})/);
  const offset = m ? `${m[1]}${m[2].padStart(2, "0")}:00` : "-04:00";

  const today = partsFor(now);
  const lines: string[] = [];
  for (let i = 0; i < 10; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const p = partsFor(d);
    lines.push(`  ${i === 0 ? "TODAY  " : "       "}${p.weekday.padEnd(9)} ${p.date}`);
  }

  return `DATE REFERENCE — America/Toronto (UTC offset ${offset}):
Right now it is ${today.weekday}, ${today.date}, ${time} (Toronto).
${lines.join("\n")}
Resolve any weekday/relative time in the transcript using this exact table.`;
}
