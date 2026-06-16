import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { money, shortDate } from "@/lib/format";
import { dealCommission, type Deal } from "@/lib/types";
import { cyclePayment, setCommission } from "./actions";

export const dynamic = "force-dynamic";

// Fraction of commission received at each stage.
function received(stage: number, commission: number): number {
  if (stage >= 2) return commission;
  if (stage === 1) return commission * 0.5;
  return 0;
}

export default async function Earnings() {
  const supabase = await createClient();

  const { data: dealsData } = await supabase
    .from("deals")
    .select("id, client_name, status, quote_price, commission, payment_stage, updated_at")
    .eq("status", "won")
    .order("updated_at", { ascending: false });
  const won = (dealsData ?? []) as (Deal & { payment_stage?: number })[];

  const totalCommission = won.reduce((s, d) => s + dealCommission(d), 0);
  const realized = won.reduce((s, d) => s + received(d.payment_stage ?? 0, dealCommission(d)), 0);
  const outstanding = totalCommission - realized;

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold">Earnings</h1>
        <Link href="/" className="text-sm text-accent">Done</Link>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Card><p className="text-xs text-muted">Received</p><p className="mt-1 text-lg font-semibold text-won">{money(realized)}</p></Card>
        <Card><p className="text-xs text-muted">Outstanding</p><p className="mt-1 text-lg font-semibold text-followup">{money(outstanding)}</p></Card>
        <Card><p className="text-xs text-muted">Total won</p><p className="mt-1 text-lg font-semibold">{money(totalCommission)}</p></Card>
      </div>

      <p className="text-xs text-muted">
        Commission is <b className="text-text">~9%</b> of the quote unless you set an amount.
        Tap the payment button to switch: <b className="text-text">1st 50%</b> → <b className="text-text">paid in full</b>.
      </p>

      <section className="flex flex-col gap-2">
        {won.length === 0 ? (
          <Card><p className="text-sm text-muted">No won deals yet. Win a deal and it shows up here.</p></Card>
        ) : (
          won.map((d) => {
            const stage = d.payment_stage ?? 0;
            const comm = dealCommission(d);
            return (
              <Card key={d.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.client_name}</p>
                    <p className="text-xs text-muted">
                      {money(d.quote_price)} · commission {money(comm)} · {shortDate(d.updated_at)}
                    </p>
                  </div>
                  <form action={cyclePayment} className="shrink-0">
                    <input type="hidden" name="id" value={d.id} />
                    <button
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        stage === 2
                          ? "bg-won/20 text-won"
                          : stage === 1
                            ? "bg-followup/20 text-followup"
                            : "border border-hairline text-muted"
                      }`}
                    >
                      {stage === 2 ? "Paid in full ✓✓" : stage === 1 ? "1st 50% ✓" : "Mark 1st payment"}
                    </button>
                  </form>
                </div>

                {/* Manual commission override */}
                <form action={setCommission} className="mt-2 flex items-center gap-1.5">
                  <input type="hidden" name="id" value={d.id} />
                  <span className="text-xs text-muted">Commission $</span>
                  <input
                    name="commission"
                    type="number"
                    inputMode="decimal"
                    defaultValue={d.commission ?? ""}
                    placeholder={`${comm} (~9%)`}
                    className="w-24 rounded-lg px-2 py-1 text-sm"
                  />
                  <button className="rounded-full border border-hairline px-2.5 py-1 text-xs text-text">Set</button>
                </form>
              </Card>
            );
          })
        )}
      </section>
    </main>
  );
}
