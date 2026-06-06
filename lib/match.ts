// SPEC.md Section 8 — identity resolution. The decision logic is a pure function
// so it can be unit-tested without a database. Phase 1 implements the safe rungs
// of the ladder: exact phone → auto-attach; otherwise create a new deal. (The
// name-based disambiguation card arrives with the approval UI in Phase 2 —
// "never attach on name alone".)

export interface DealCandidate {
  id: string;
  client_name: string | null;
  phone: string | null;
  status: string;
  updated_at: string;
}

export interface MatchHints {
  phone: string | null;
  name: string | null;
}

export type Match =
  | { kind: "phone"; dealId: string }
  | { kind: "none" };

// Keep digits only, so "(416) 555-1212" and "4165551212" compare equal.
export function normalizePhone(p: string | null | undefined): string {
  return (p ?? "").replace(/\D/g, "");
}

export function chooseMatch(
  candidates: DealCandidate[],
  hints: MatchHints,
): Match {
  const phone = normalizePhone(hints.phone);
  if (phone.length >= 7) {
    const hit = candidates.find((c) => normalizePhone(c.phone) === phone);
    if (hit) return { kind: "phone", dealId: hit.id };
  }
  // No phone match → do not guess from the name alone.
  return { kind: "none" };
}
