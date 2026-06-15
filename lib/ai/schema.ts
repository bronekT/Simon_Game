import { z } from "zod";

// SPEC.md Section 7 — the strict JSON contract the extraction call must return.
// We validate every model output against this; anything that fails is flagged
// (needs_review) and never acted on (Section 1, principle 5).

const nullableStr = z.string().nullable();

export const RECORD_TYPES = [
  "booking_call",
  "appointment",
  "followup_call",
  "note",
] as const;

const LOCATION = z
  .enum(["home", "showroom", "phone", "virtual"])
  .nullable();

const SERVICE = z
  .enum(["roofing", "doors", "windows", "siding", "insulation", "other"])
  .nullable();

const DOOR = z
  .enum([
    "entry", "patio", "storm", "french", "sliding",
    "garage", "interior", "bifold", "screen", "other",
  ])
  .nullable();

export const DraftSchema = z.object({
  // Kept as a loose string here; sanitized to the DB enum on persist.
  type: z.string(),
  channel: z.enum(["email", "sms"]),
  subject: z.string().default(""),
  body: z.string(),
});

export const ExtractionSchema = z.object({
  record_type: z.enum(RECORD_TYPES),
  location_type: LOCATION,
  client: z.object({
    name: nullableStr,
    phone: nullableStr,
    email: nullableStr,
    address: nullableStr,
  }),
  service_type: SERVICE,
  door_type: DOOR, // the main door type the client wants
  door_count: z.number().nullable(), // how many doors
  match_hints: z.array(z.string()).default([]),
  summary: z.string(),
  objections: z.array(z.string()).default([]),
  competitor: nullableStr,
  decision_maker: nullableStr,
  budget_signal: nullableStr,
  close_probability: z.number(),
  scores: z.object({
    rapport: z.number(),
    discovery: z.number(),
    pain: z.number(),
    product: z.number(),
    objection: z.number(),
    closing: z.number(),
    followup: z.number(),
  }),
  talk_ratio: z.number(), // % of time the SALESPERSON spoke
  sentiment: z.string(),
  personal_hooks: z.array(z.string()).default([]),
  what_went_well: z.string(),
  what_went_wrong: z.string(),
  next_action: z.string(),
  followup_at: nullableStr, // ISO datetime | null
  proposed_event: z
    .object({
      title: z.string(),
      start: z.string(),
      location: z.string().default(""),
      notes: z.string().default(""),
    })
    .nullable(),
  drafts: z.array(DraftSchema).default([]),
  confirmation_sms: nullableStr, // only for booking_call
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type Draft = z.infer<typeof DraftSchema>;

// Output of the Sonnet writer (polished follow-ups + a short coaching note).
export const WriterSchema = z.object({
  drafts: z.array(DraftSchema).default([]),
  coach_note: z.string().default(""),
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
