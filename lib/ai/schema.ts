import { z } from "zod";

// SPEC.md Section 7 — the JSON contract the extraction call must return.
// We validate every model output against this. To be robust to small shape
// variations from the model (a field returned as a number/object/array, a
// missing score key, a stray enum value), the schema COERCES loosely rather
// than rejecting — invalid-but-recoverable output still produces a usable deal.
// Genuinely broken output (not JSON at all) is still flagged needs_review.

export const RECORD_TYPES = [
  "booking_call",
  "appointment",
  "followup_call",
  "note",
] as const;

const DOOR_VALUES = [
  "entry", "patio", "storm", "french", "sliding",
  "garage", "interior", "bifold", "screen", "other",
] as const;
const SERVICE_VALUES = ["roofing", "doors", "windows", "siding", "insulation", "other"] as const;
const LOCATION_VALUES = ["home", "showroom", "phone", "virtual"] as const;

// string | null, but tolerant of numbers/objects/arrays.
const looseStr = z.preprocess((v) => {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() === "" ? null : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.length ? v.map(String).join(", ") : null;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.name === "string") return o.name;
    return JSON.stringify(v);
  }
  return null;
}, z.string().nullable());

// Required text — never fails; missing/odd becomes "".
const looseText = z.preprocess((v) => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return "";
}, z.string());

const looseNum = z.preprocess((v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}, z.number());

const looseNumNullable = z.preprocess((v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}, z.number().nullable());

const looseStrArray = z.preprocess((v) => {
  if (Array.isArray(v)) return v.filter((x) => x != null).map(String);
  if (v == null || v === "") return [];
  return [String(v)];
}, z.array(z.string()));

// An enum that maps anything outside the allowed set to null.
function looseEnumNullable<const T extends readonly string[]>(values: T) {
  return z.preprocess(
    (v) => (typeof v === "string" && (values as readonly string[]).includes(v) ? v : null),
    z.enum(values as unknown as [string, ...string[]]).nullable(),
  );
}

const recordType = z.preprocess(
  (v) => (typeof v === "string" && (RECORD_TYPES as readonly string[]).includes(v) ? v : "note"),
  z.enum(RECORD_TYPES),
);

export const DraftSchema = z.object({
  type: looseText,
  channel: z.preprocess((v) => (v === "sms" ? "sms" : "email"), z.enum(["email", "sms"])),
  subject: looseText.default(""),
  body: looseText,
});

const scoresSchema = z.preprocess(
  (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {}),
  z
    .object({
      rapport: looseNum, discovery: looseNum, pain: looseNum, product: looseNum,
      objection: looseNum, closing: looseNum, followup: looseNum,
    })
    .partial(),
).transform((s) => ({
  rapport: s.rapport ?? 0, discovery: s.discovery ?? 0, pain: s.pain ?? 0,
  product: s.product ?? 0, objection: s.objection ?? 0, closing: s.closing ?? 0,
  followup: s.followup ?? 0,
}));

const clientSchema = z.preprocess(
  (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {}),
  z.object({ name: looseStr, phone: looseStr, email: looseStr, address: looseStr }).partial(),
).transform((c) => ({
  name: c.name ?? null, phone: c.phone ?? null, email: c.email ?? null, address: c.address ?? null,
}));

const proposedEvent = z.preprocess(
  (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null),
  z
    .object({ title: looseText, start: looseText, location: looseText.default(""), notes: looseText.default("") })
    .nullable(),
);

export const ExtractionSchema = z.object({
  record_type: recordType,
  location_type: looseEnumNullable(LOCATION_VALUES),
  client: clientSchema,
  service_type: looseEnumNullable(SERVICE_VALUES),
  door_type: looseEnumNullable(DOOR_VALUES),
  door_count: looseNumNullable,
  quote_price: looseNumNullable, // a specific quoted/ballpark price if stated
  outcome: looseEnumNullable(["won", "lost"] as const), // deal clearly closed?
  match_hints: looseStrArray.default([]),
  summary: looseText,
  objections: looseStrArray.default([]),
  competitor: looseStr,
  decision_maker: looseStr,
  budget_signal: looseStr,
  close_probability: looseNum,
  scores: scoresSchema,
  talk_ratio: looseNum,
  sentiment: looseText,
  personal_hooks: looseStrArray.default([]),
  what_went_well: looseText,
  what_went_wrong: looseText,
  next_action: looseText,
  followup_at: looseStr,
  proposed_event: proposedEvent,
  drafts: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(DraftSchema)).default([]),
  confirmation_sms: looseStr,
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type Draft = z.infer<typeof DraftSchema>;

// One concrete coaching point: what happened, what to say instead, the technique.
export const CoachingPointSchema = z.object({
  situation: looseText, // what happened / what the client said
  better: looseText, // a better thing to have said (exact words)
  technique: looseText.default(""), // the sales technique it uses
});
export type CoachingPoint = z.infer<typeof CoachingPointSchema>;

// Output of the Sonnet writer (polished follow-ups + detailed coaching).
export const WriterSchema = z.object({
  drafts: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(DraftSchema)).default([]),
  coach_note: looseText.default(""),
  coaching: z
    .preprocess((v) => (Array.isArray(v) ? v : []), z.array(CoachingPointSchema))
    .default([]),
});
export type WriterOutput = z.infer<typeof WriterSchema>;

// Allowed DB draft types (must match the draft_type enum in 0001_init.sql).
const DB_DRAFT_TYPES = new Set([
  "soft", "urgency", "price", "competitor", "financing",
  "decision_maker", "showroom_invite", "last_chance",
  "reactivation", "confirmation",
]);

// Coerce a model-provided draft type onto the DB enum (default "soft").
export function safeDraftType(t: string): string {
  const norm = t.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return DB_DRAFT_TYPES.has(norm) ? norm : "soft";
}
