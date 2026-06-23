import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dealCommission } from "@/lib/types";
import { wonDates } from "@/lib/won";
import { TZ } from "@/lib/format";

export const dynamic = "force-dynamic";

const OPEN = ["new", "booked", "met", "quoted", "negotiation"];
const GOAL_DEFAULT = 10_000;

function monthKey(iso: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(new Date(iso));
  return `${p.find((x) => x.type === "year")?.value}-${p.find((x) => x.type === "month")?.value}`;
}
function received(stage: number, c: number): number {
  if (stage >= 2) return c;
  if (stage === 1) return c * 0.5;
  return 0;
}

// Read-only JSON for a Scriptable home-screen widget. Auth via a per-user token
// (?token=...) so no login is needed. CORS-open since it's read-only + tokened.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 401 });

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("settings")
    .select("user_id, monthly_goal")
    .eq("widget_token", token)
    .maybeSingle();
  if (!settings?.user_id) return NextResponse.json({ error: "invalid token" }, { status: 401 });
  const userId = settings.user_id as string;

  const { data: dealsData } = await admin
    .from("deals")
    .select("id, client_name, status, quote_price, commission, payment_stage, probability, next_action, followup_at, updated_at")
    .eq("user_id", userId);
  const deals = dealsData ?? [];

  const open = deals.filter((d) => OPEN.includes(d.status as string));
  const pipeline = open.reduce((s, d) => s + (Number(d.quote_price) || 0), 0);

  // Commission — counted by the month each deal was actually won (stable date).
  const won = deals.filter((d) => d.status === "won");
  const wonAt = await wonDates(admin, won.map((d) => d.id as string));
  const thisKey = monthKey(new Date().toISOString());

  let commissionMonth = 0;
  let wonValueMonth = 0;
  let wonCountMonth = 0;
  let totalCommission = 0;
  let totalReceived = 0;
  for (const d of won) {
    const c = dealCommission(d as { commission: number | null; quote_price: number | null });
    totalCommission += c;
    totalReceived += received(Number(d.payment_stage) || 0, c);
    const k = monthKey((wonAt.get(d.id as string) ?? (d.updated_at as string)) || new Date().toISOString());
    if (k === thisKey) {
      commissionMonth += c;
      wonValueMonth += Number(d.quote_price) || 0;
      wonCountMonth += 1;
    }
  }
  const goal = Number(settings.monthly_goal) || GOAL_DEFAULT;
  const goalPct = goal > 0 ? Math.min(100, Math.round((commissionMonth / goal) * 100)) : 0;

  const nowIso = new Date().toISOString();
  const next = deals
    .filter((d) => d.followup_at && (d.followup_at as string) >= nowIso)
    .sort((a, b) => (a.followup_at as string).localeCompare(b.followup_at as string))[0];

  return NextResponse.json(
    {
      commission_month: Math.round(commissionMonth),
      won_value_month: Math.round(wonValueMonth),
      won_count_month: wonCountMonth,
      goal,
      goal_pct: goalPct,
      outstanding: Math.round(totalCommission - totalReceived),
      pipeline,
      open_deals: open.length,
      next_appointment: next ? { client: next.client_name, at: next.followup_at } : null,
      generated_at: new Date().toISOString(),
    },
    { headers: { "access-control-allow-origin": "*", "cache-control": "no-store" } },
  );
}
