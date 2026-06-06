import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseMatch, normalizePhone, type DealCandidate } from "../lib/match";

const deals: DealCandidate[] = [
  { id: "d1", client_name: "Jane Roof", phone: "(416) 555-1212", status: "quoted", updated_at: "2026-06-01T00:00:00Z" },
  { id: "d2", client_name: "John Door", phone: "647-000-9999", status: "new", updated_at: "2026-05-01T00:00:00Z" },
];

test("normalizePhone keeps digits only", () => {
  assert.equal(normalizePhone("(416) 555-1212"), "4165551212");
  assert.equal(normalizePhone(null), "");
});

test("exact phone (any formatting) auto-attaches", () => {
  const m = chooseMatch(deals, { phone: "4165551212", name: null });
  assert.deepEqual(m, { kind: "phone", dealId: "d1" });
});

test("never attaches on name alone", () => {
  const m = chooseMatch(deals, { phone: null, name: "Jane Roof" });
  assert.deepEqual(m, { kind: "none" });
});

test("unknown phone does not match", () => {
  const m = chooseMatch(deals, { phone: "905-111-2222", name: "Jane Roof" });
  assert.deepEqual(m, { kind: "none" });
});

test("too-short phone is ignored", () => {
  const m = chooseMatch(deals, { phone: "1212", name: null });
  assert.deepEqual(m, { kind: "none" });
});
