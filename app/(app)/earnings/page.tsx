import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { money, shortDate } from "@/lib/format";
import { OPEN_STATUSES, type Deal } from "@/lib/types";
import { toggleCommissionPaid } from "./actions";

export const dynamic = "force-dynamic";

export default async function Earnings() {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("settings")
    .select("commission_self, monthly_goal")
    .maybeSingle();
  const pct = settings?.commission_self ?? null;
  const goal = settings?.monthly_goal ?? null;

  const { data: dealsData } = await supabase
    .from("deals")
    .select("id, client_name, status, quote_price, probability, updated_at, commission_paid")
    .order("updated_at", { ascending: false });
  const deals = (dealsData ?? []) as (Deal & { commission_paid?: boolean })[];

  const commission = (value: number | null) =>
    pct != null && value != null ? (value * pct) / 100 : 0;

  const won = deals.filter((d) => d.status === "won");
  const open = deals.filter((d) => OPEN_STATUSES.includes(d.status));

  const realized = won.filter((d) => d.commission_paid)
    .reduce((s, d) => s + commission(d.quote_price), 0);
  const pendingWon = won.filter((d) => !d.commission_paid)
    .reduce((s, d) => s + commission(d.quote_price), 0);
  // Weighted pipeline commission (by probability) — your potential upside.
  const pipelinePotential = open.reduce(
    (s, d) => s + commission(d.quote_price) * ((d.probability ?? 0) / 100),
    0,
  );

  const now = new Date();
  const wonThisMonth = won.filter(
    (d) =>
      new Date(d.updated_at).getMonth() === now.getMonth() &&
      new Date(d.updated_at).getFullYear() === now.getFullYear(),
  );
  const earnedThisMonth = wonThisMonth.reduce((s, d) => s + commission(d.quote_price), 0);

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold">Earnings</h1>
        <Link href="/" className="text-sm text-accent">Done</Link>
      </header>

      {pct == null && (
        <Card className="border-followup/40">
          <p className="text-sm text-followup">Set your commission %</p>
          <p className="mt-1 text-xs text-muted">
            Add your commission rate in{" "}
            <Link href="/settings" className="text-accent">Settings</Link> to see real numbers.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-muted">Realized (received)</p>
          <p className="mt-1 text-xl font-semibold text-won">{money(realized)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Won, awaiting payout</p>
          <p className="mt-1 text-xl font-semibold text-followup">{money(pendingWon)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">This month earned</p>
          <p className="mt-1 text-lg font-semibold">{money(earnedThisMonth)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Pipeline potential</p>
          <p className="mt-1 text-lg font-semibold text-accent">{money(pipelinePotential)}</p>
          <p className="mt-0.5 text-[11px] text-muted">weighted by probability</p>
        </Card>
      </div>

      {goal && pct != null && (
        <Card>
          <p className="text-xs text-muted">
            Goal is {money(goal)} in sales · ~{money(commission(goal))} commission to you
          </p>
        </Card>
      )}

      {/* Won deals — mark each as paid when the money lands */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Won deals</h2>
        {won.length === 0 ? (
          <Card><p className="text-sm text-muted">No won deals yet.</p></Card>
        ) : (
          won.map((d) => (
            <Card key={d.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{d.client_name}</p>
                  <p className="text-xs text-muted">
                    {money(d.quote_price)} · your cut {money(commission(d.quote_price))} · {shortDate(d.updated_at)}
                  </p>
                </div>
                <form action={toggleCommissionPaid}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="paid" value={String(Boolean(d.commission_paid))} />
                  <button
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      d.commission_paid
                        ? "bg-won/15 text-won"
                        : "border border-hairline text-muted"
                    }`}
                  >
                    {d.commission_paid ? "Paid ✓" : "Mark paid"}
                  </button>
                </form>
              </div>
            </Card>
          ))
        )}
      </section>
    </main>
  );
}
