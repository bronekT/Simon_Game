import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { DealCard } from "@/components/DealCard";
import { SectionHeader } from "@/components/SectionHeader";
import { HomeMenu } from "@/components/HomeMenu";
import { Count } from "@/components/Count";
import { Ring } from "@/components/Ring";
import { money, TZ } from "@/lib/format";
import { wonDates } from "@/lib/won";
import { OPEN_STATUSES, dealCommission, type Deal } from "@/lib/types";

const MONTHLY_GOAL = 10_000;
function monthKey(iso: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(new Date(iso));
  return `${p.find((x) => x.type === "year")?.value}-${p.find((x) => x.type === "month")?.value}`;
}

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createClient();

  const { data: deals } = await supabase
    .from("deals")
    .select("*")
    .order("updated_at", { ascending: false });

  const { data: settings } = await supabase
    .from("settings")
    .select("monthly_goal, commission_self")
    .maybeSingle();

  const all = (deals ?? []) as Deal[];
  const open = all.filter((d) => OPEN_STATUSES.includes(d.status));
  const pipeline = open.reduce((sum, d) => sum + (d.quote_price ?? 0), 0);
  const atRisk = open.filter((d) => (d as Deal & { at_risk?: boolean }).at_risk);

  // Won "this month" by the month the deal was actually WON (stable; matches
  // Earnings), not updated_at which drifts when you edit the deal later.
  const allWon = all.filter((d) => d.status === "won");
  const wonAt = await wonDates(supabase, allWon.map((d) => d.id));
  const thisKey = monthKey(new Date().toISOString());
  const wonThisMonth = allWon.filter((d) => monthKey(wonAt.get(d.id) ?? d.updated_at) === thisKey);
  const wonValue = wonThisMonth.reduce((s, d) => s + (d.quote_price ?? 0), 0);
  const goal = settings?.monthly_goal ?? MONTHLY_GOAL;
  // Per-deal commission (your manual amount, or ~9%) — matches Earnings.
  const myCommission = wonThisMonth.reduce((s, d) => s + dealCommission(d), 0);
  // Goal is your monthly COMMISSION target ($10k).
  const goalPct = goal > 0 ? Math.min(100, Math.round((myCommission / goal) * 100)) : null;

  // "Money Moves": open deals, highest probability first, then by quote value.
  const moneyMoves = [...open]
    .sort(
      (a, b) =>
        (b.probability ?? 0) - (a.probability ?? 0) ||
        (b.quote_price ?? 0) - (a.quote_price ?? 0),
    )
    .slice(0, 3);

  return (
    <main className="flex flex-col gap-5">
      <header className="relative z-50 flex items-start justify-between pt-2">
        <div>
          <p className="text-sm text-muted">{greeting()}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        </div>
        <HomeMenu />
      </header>

      {/* Commission hero — the motivating number, with a goal ring */}
      <Link href="/earnings">
        <Card glow className="active:scale-[0.99]">
          <div className="flex items-center gap-4">
            <Ring pct={goalPct ?? 0} size={84} stroke={9}>
              <span className="text-sm font-bold">{goalPct ?? 0}%</span>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">Your commission this month</p>
              <Count value={myCommission} money className="mt-0.5 block text-3xl font-bold gradient-text" />
              <p className="mt-0.5 text-xs text-muted">
                {goal ? <>of <b className="text-text">{money(goal)}</b> goal</> : "Set a goal"} · tap for Earnings ›
              </p>
            </div>
          </div>
        </Card>
      </Link>

      {/* Pipeline / won row */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-muted">Open pipeline</p>
          <Count value={pipeline} money className="mt-1 block text-xl font-semibold" />
          <p className="mt-0.5 text-xs text-muted">{open.length} open deals</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Won this month</p>
          <Count value={wonValue} money className="mt-1 block text-xl font-semibold gradient-won" />
          <p className="mt-0.5 text-xs text-muted">
            {wonThisMonth.length} {wonThisMonth.length === 1 ? "deal" : "deals"} won
          </p>
        </Card>
      </div>

      {/* At-risk alerts */}
      {atRisk.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-risk">
            <span className="h-1.5 w-1.5 rounded-full bg-risk" /> At risk {atRisk.length}
          </h2>
          {atRisk.slice(0, 3).map((d) => (
            <DealCard key={d.id} deal={d} showFollowup />
          ))}
        </section>
      )}

      {/* Money Moves */}
      <section className="flex flex-col gap-2.5">
        <SectionHeader
          title="Money moves"
          action={<Link href="/deals" className="text-xs text-accent">All deals</Link>}
        />

        {moneyMoves.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">
              No open deals yet. Tap{" "}
              <Link href="/deals/new" className="text-accent">
                Add
              </Link>{" "}
              to create your first one.
            </p>
          </Card>
        ) : (
          moneyMoves.map((d) => <DealCard key={d.id} deal={d} showFollowup />)
        )}
      </section>
    </main>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
