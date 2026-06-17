import type { SupabaseClient } from "@supabase/supabase-js";

// Record the moment a deal is won, in the `outcomes` table, so monthly commission
// is counted in the month it was actually won — and never drifts when the deal is
// later edited (unlike updated_at, which a trigger bumps on every change).
// Keeps only the FIRST win (the original date); no-op if already recorded.
export async function recordWon(
  supabase: SupabaseClient,
  dealId: string,
  userId?: string,
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("outcomes")
      .select("id")
      .eq("deal_id", dealId)
      .eq("result", "won")
      .limit(1)
      .maybeSingle();
    if (existing) return;
    const row: Record<string, unknown> = { deal_id: dealId, result: "won" };
    if (userId) row.user_id = userId; // admin client has no auth.uid() default
    await supabase.from("outcomes").insert(row);
  } catch {
    /* best-effort — never block the status change */
  }
}

// Map deal_id → won date (recorded_at) for a set of deals.
export async function wonDates(
  supabase: SupabaseClient,
  dealIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (dealIds.length === 0) return map;
  const { data } = await supabase
    .from("outcomes")
    .select("deal_id, recorded_at")
    .eq("result", "won")
    .in("deal_id", dealIds)
    .order("recorded_at", { ascending: true });
  for (const r of data ?? []) {
    // First (earliest) win wins.
    if (!map.has(r.deal_id as string)) map.set(r.deal_id as string, r.recorded_at as string);
  }
  return map;
}
