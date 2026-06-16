import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { DealCard } from "@/components/DealCard";
import { SectionHeader } from "@/components/SectionHeader";
import { HomeMenu } from "@/components/HomeMenu";
import { money } from "@/lib/format";
import { OPEN_STATUSES, dealCommission, type Deal } from "@/lib/types";

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

  const now = new Date();
  const wonThisMonth = all.filter(
    (d) =>
      d.status === "won" &&
      new Date(d.updated_at).getMonth() === now.getMonth() &&
      new Date(d.updated_at).getFullYear() === now.getFullYear(),
  );
  const wonValue = wonThisMonth.reduce((s, d) => s + (d.quote_price ?? 0), 0);
  const goal = settings?.monthly_goal ?? null;
  // Per-deal commission (your manual amount, or ~9%) — matches Earnings.
  const myCommission = wonThisMonth.reduce((s, d) => s + dealCommission(d), 0);
  const goalPct = goal && goal > 0 ? Math.min(100, Math.round((wonValue / goal) * 100)) : null;

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
      <header className="flex items-start justify-between pt-2">
        <div>
          <p className="text-sm text-muted">{greeting()}</p>
          <h1 className="text-2xl font-semibold">Today</h1>
        </div>
        <HomeMenu />
      </header>

      {/* Commission / goal row */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-muted">Open pipeline</p>
          <p className="mt-1 text-xl font-semibold">{money(pipeline)}</p>
          <p className="mt-0.5 text-xs text-muted">{open.length} open deals</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Won this month</p>
          <p className="mt-1 text-xl font-semibold text-won">{money(wonValue)}</p>
          <p className="mt-0.5 text-xs text-muted">
            {goal ? `Goal ${money(goal)}` : "Set a goal in Settings"}
          </p>
        </Card>
      </div>

      {/* Commission tracker — tap for the full Earnings view */}
      <Link href="/earnings">
        <Card className="active:bg-white/[0.05]">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Commission this month</p>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold">{money(myCommission)}</p>
              <span className="text-muted">›</span>
            </div>
          </div>
          {goalPct != null && (
            <>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-won" style={{ width: `${goalPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">{goalPct}% of {money(goal)} sales goal</p>
            </>
          )}
        </Card>
      </Link>

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
