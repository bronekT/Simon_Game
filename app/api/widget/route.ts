import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const OPEN = ["new", "booked", "met", "quoted", "negotiation"];

// Read-only JSON for a Scriptable home-screen widget (SPEC.md Phase 5):
// top-3 money moves, next appointment, pipeline total. Auth via a per-user token
// (?token=...) so no login is needed. CORS-open since it's read-only + tokened.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "missing token" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("settings")
    .select("user_id, monthly_goal")
    .eq("widget_token", token)
    .maybeSingle();
  if (!settings?.user_id) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }
  const userId = settings.user_id as string;

  const { data: dealsData } = await admin
    .from("deals")
    .select("id, client_name, status, quote_price, probability, next_action, followup_at")
    .eq("user_id", userId);
  const deals = dealsData ?? [];

  const open = deals.filter((d) => OPEN.includes(d.status as string));
  const pipeline = open.reduce((s, d) => s + (Number(d.quote_price) || 0), 0);

  const topMoves = [...open]
    .sort(
      (a, b) =>
        (Number(b.probability) || 0) - (Number(a.probability) || 0) ||
        (Number(b.quote_price) || 0) - (Number(a.quote_price) || 0),
    )
    .slice(0, 3)
    .map((d) => ({
      client: d.client_name,
      next_action: d.next_action,
      value: Number(d.quote_price) || 0,
    }));

  const nowIso = new Date().toISOString();
  const next = deals
    .filter((d) => d.followup_at && (d.followup_at as string) >= nowIso)
    .sort((a, b) => (a.followup_at as string).localeCompare(b.followup_at as string))[0];

  return NextResponse.json(
    {
      pipeline,
      open_deals: open.length,
      monthly_goal: Number(settings.monthly_goal) || null,
      top_moves: topMoves,
      next_appointment: next
        ? { client: next.client_name, at: next.followup_at }
        : null,
      generated_at: new Date().toISOString(),
    },
    { headers: { "access-control-allow-origin": "*", "cache-control": "no-store" } },
  );
}
