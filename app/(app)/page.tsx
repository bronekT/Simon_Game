import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { DoorWantLine, EngagementChips } from "@/components/DealMeta";
import { money, shortDate } from "@/lib/format";
import { OPEN_STATUSES, type Deal } from "@/lib/types";

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
  const commissionPct = settings?.commission_self ?? null;
  const myCommission = commissionPct != null ? (wonValue * commissionPct) / 100 : null;
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
        <div className="flex items-center gap-4">
          <Link href="/earnings" className="text-sm text-muted">
            Earnings
          </Link>
          <Link href="/coach" className="text-sm text-muted">
            Coach
          </Link>
          <Link href="/settings" className="text-sm text-muted">
            Settings
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm text-muted">
              Sign out
            </button>
          </form>
        </div>
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

      {/* Commission / OTE tracker — tap for the full Earnings view */}
      {(goal || myCommission != null) && (
        <Link href="/earnings">
          <Card className="active:bg-white/[0.05]">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">
                {myCommission != null ? "Your commission this month" : "Goal progress"}
              </p>
              <div className="flex items-center gap-1.5">
                {myCommission != null && (
                  <p className="text-sm font-semibold text-accent">{money(myCommission)}</p>
                )}
                <span className="text-muted">›</span>
              </div>
            </div>
            {goalPct != null && (
              <>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-won" style={{ width: `${goalPct}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {goalPct}% of {money(goal)} goal
                </p>
              </>
            )}
          </Card>
        </Link>
      )}

      {/* At-risk alerts */}
      {atRisk.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-risk">At risk ({atRisk.length})</h2>
          {atRisk.slice(0, 3).map((d) => (
            <Link key={d.id} href={`/deals/${d.id}`}>
              <Card className="border-risk/30 active:bg-white/[0.05]">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm">{d.client_name}</span>
                  <span className="text-xs text-risk">No activity 3+ days</span>
                </div>
              </Card>
            </Link>
          ))}
        </section>
      )}

      {/* Money Moves */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Money Moves</h2>
          <Link href="/deals" className="text-sm text-accent">
            All deals
          </Link>
        </div>

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
          moneyMoves.map((d) => (
            <Link key={d.id} href={`/deals/${d.id}`}>
              <Card className="active:bg-white/[0.05]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.client_name}</p>
                    {(d.door_type || d.door_count) && (
                      <p className="mt-0.5 truncate text-sm">
                        <DoorWantLine type={d.door_type} count={d.door_count} />
                      </p>
                    )}
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {d.next_action ?? "No next action set"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status={d.status} />
                    <p className="mt-1 text-sm font-medium">
                      {money(d.quote_price)}
                    </p>
                  </div>
                </div>
                <EngagementChips deal={d} className="mt-3" />
                {d.followup_at && (
                  <p className="mt-2 text-xs text-followup">
                    Follow up {shortDate(d.followup_at)}
                  </p>
                )}
              </Card>
            </Link>
          ))
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
