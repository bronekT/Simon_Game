import { test } from "node:test";
import assert from "node:assert/strict";
import { ExtractionSchema, safeDraftType } from "../lib/ai/schema";
import { extractJson } from "../lib/ai/anthropic";

// A minimal valid Section 7 object used as a fixture.
const valid = {
  record_type: "appointment",
  location_type: "home",
  client: { name: "Jane Roof", phone: "416-555-1212", email: null, address: "12 Oak St" },
  service_type: "doors",
  door_type: "patio",
  door_count: 3,
  match_hints: ["jane door", "oak st"],
  summary: "Wants a full roof replacement before winter. Worried about price.",
  objections: ["price too high"],
  competitor: "ABC Roofing",
  decision_maker: "Jane and her husband",
  budget_signal: "mentioned 15k budget",
  close_probability: 60,
  scores: { rapport: 8, discovery: 7, pain: 6, product: 7, objection: 5, closing: 4, followup: 6 },
  talk_ratio: 55,
  sentiment: "warm",
  personal_hooks: ["just had a baby"],
  what_went_well: "Built good rapport.",
  what_went_wrong: "Did not lock a follow-up time.",
  next_action: "Send revised quote with financing options.",
  followup_at: "2026-06-10T15:00:00.000Z",
  proposed_event: null,
  drafts: [{ type: "price", channel: "email", subject: "Your roof quote", body: "Hi Jane…" }],
  confirmation_sms: null,
};

test("valid extraction parses", () => {
  const r = ExtractionSchema.safeParse(valid);
  assert.equal(r.success, true);
});

test("missing fields are coerced, not rejected (robust to model variance)", () => {
  const bad: Record<string, unknown> = { ...valid };
  delete bad.summary;
  delete bad.scores;
  const r = ExtractionSchema.safeParse(bad);
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.summary, "");
    assert.equal(r.data.scores.objection, 0);
  }
});

test("odd field shapes coerce (competitor as object, score as string)", () => {
  const odd = { ...valid, competitor: { name: "ABC Doors" }, scores: { ...valid.scores, objection: "5" } };
  const r = ExtractionSchema.safeParse(odd);
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.competitor, "ABC Doors");
    assert.equal(r.data.scores.objection, 5);
  }
});

test("unknown record_type coerces to note", () => {
  const r = ExtractionSchema.safeParse({ ...valid, record_type: "chitchat" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.record_type, "note");
});

test("extractJson pulls JSON out of prose and code fences", () => {
  const wrapped = 'Sure! Here you go:\n```json\n{"a": 1, "b": {"c": 2}}\n```\nHope that helps.';
  const out = extractJson(wrapped);
  assert.ok(out);
  assert.deepEqual(JSON.parse(out!), { a: 1, b: { c: 2 } });
});

test("extractJson handles braces inside strings", () => {
  const s = '{"text": "use {curly} braces", "n": 3}';
  const out = extractJson(s);
  assert.deepEqual(JSON.parse(out!), { text: "use {curly} braces", n: 3 });
});

test("safeDraftType coerces unknown types to a safe default", () => {
  assert.equal(safeDraftType("price"), "price");
  assert.equal(safeDraftType("Decision-Maker"), "decision_maker");
  assert.equal(safeDraftType("something weird"), "soft");
});
