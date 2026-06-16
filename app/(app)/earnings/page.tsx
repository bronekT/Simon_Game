import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { money, shortDate } from "@/lib/format";
import { OPEN_STATUSES, dealCommission, type Deal } from "@/lib/types";
import { toggleCommissionPaid, setCommission } from "./actions";

export const dynamic = "force-dynamic";

export default async function Earnings() {
  const supabase = await createClient();

  const { data: dealsData } = await supabase
    .from("deals")
    .select("id, client_name, status, quote_price, probability, updated_at, commission, commission_paid")
    .order("updated_at", { ascending: false });
  const deals = (dealsData ?? []) as (Deal & { commission_paid?: boolean })[];

  const won = deals.filter((d) => d.status === "won");
  const open = deals.filter((d) => OPEN_STATUSES.includes(d.status));

  const realized = won.filter((d) => d.commission_paid).reduce((s, d) => s + dealCommission(d), 0);
  const pendingWon = won.filter((d) => !d.commission_paid).reduce((s, d) => s + dealCommission(d), 0);
  const pipelinePotential = open.reduce(
    (s, d) => s + dealCommission(d) * ((d.probability ?? 0) / 100),
    0,
  );

  const now = new Date();
  const earnedThisMonth = won
    .filter((d) => new Date(d.updated_at).getMonth() === now.getMonth() && new Date(d.updated_at).getFullYear() === now.getFullYear())
    .reduce((s, d) => s + dealCommission(d), 0);

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold">Earnings</h1>
        <Link href="/" className="text-sm text-accent">Done</Link>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card><p className="text-xs text-muted">Realized (received)</p><p className="mt-1 text-xl font-semibold text-won">{money(realized)}</p></Card>
        <Card><p className="text-xs text-muted">Won, awaiting payout</p><p className="mt-1 text-xl font-semibold text-followup">{money(pendingWon)}</p></Card>
        <Card><p className="text-xs text-muted">This month earned</p><p className="mt-1 text-lg font-semibold">{money(earnedThisMonth)}</p></Card>
        <Card><p className="text-xs text-muted">Pipeline potential</p><p className="mt-1 text-lg font-semibold text-accent">{money(pipelinePotential)}</p><p className="mt-0.5 text-[11px] text-muted">weighted by probability</p></Card>
      </div>

      <p className="text-xs text-muted">
        Commission is <b className="text-text">~9%</b> of the quote unless you set an amount. Tap a number to change it.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Won deals</h2>
        {won.length === 0 ? (
          <Card><p className="text-sm text-muted">No won deals yet.</p></Card>
        ) : (
          won.map((d) => <CommissionRow key={d.id} deal={d} />)
        )}
      </section>

      {open.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">Open deals (potential)</h2>
          {open.map((d) => <CommissionRow key={d.id} deal={d} />)}
        </section>
      )}
    </main>
  );
}

function CommissionRow({ deal: d }: { deal: Deal & { commission_paid?: boolean } }) {
  const auto = d.commission == null;
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm">{d.client_name}</p>
          <p className="text-xs text-muted">{money(d.quote_price)} · {shortDate(d.updated_at)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <form action={setCommission} className="flex items-center gap-1">
            <input type="hidden" name="id" value={d.id} />
            <span className="text-muted">$</span>
            <input
              name="commission"
              type="number"
              inputMode="decimal"
              defaultValue={d.commission ?? ""}
              placeholder={String(dealCommission(d))}
              className="w-20 rounded-lg px-2 py-1 text-right text-sm"
            />
            <button className="rounded-full border border-hairline px-2 py-1 text-xs text-text">Set</button>
          </form>
          {d.status === "won" && (
            <form action={toggleCommissionPaid}>
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="paid" value={String(Boolean(d.commission_paid))} />
              <button className={`rounded-full px-2.5 py-1 text-xs font-medium ${d.commission_paid ? "bg-won/15 text-won" : "border border-hairline text-muted"}`}>
                {d.commission_paid ? "Paid ✓" : "Mark paid"}
              </button>
            </form>
          )}
        </div>
      </div>
      {auto && <p className="mt-1 text-[11px] text-muted">est. {money(dealCommission(d))} (~9%)</p>}
    </Card>
  );
}
