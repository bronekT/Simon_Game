import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
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
    .select("monthly_goal")
    .maybeSingle();

  const all = (deals ?? []) as Deal[];
  const open = all.filter((d) => OPEN_STATUSES.includes(d.status));
  const pipeline = open.reduce((sum, d) => sum + (d.quote_price ?? 0), 0);

  const now = new Date();
  const wonThisMonth = all.filter(
    (d) =>
      d.status === "won" &&
      new Date(d.updated_at).getMonth() === now.getMonth() &&
      new Date(d.updated_at).getFullYear() === now.getFullYear(),
  );
  const wonValue = wonThisMonth.reduce((s, d) => s + (d.quote_price ?? 0), 0);
  const goal = settings?.monthly_goal ?? null;

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
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm text-muted">
            Sign out
          </button>
        </form>
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
