import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { SectionHeader } from "@/components/SectionHeader";
import { money, shortDate } from "@/lib/format";
import { dealCommission, type Deal } from "@/lib/types";
import { cyclePayment, setCommission } from "./actions";

export const dynamic = "force-dynamic";

function received(stage: number, c: number): number {
  if (stage >= 2) return c;
  if (stage === 1) return c * 0.5;
  return 0;
}

export default async function Earnings() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("id, client_name, status, quote_price, commission, payment_stage, updated_at")
    .eq("status", "won")
    .order("updated_at", { ascending: false });
  const won = (data ?? []) as (Deal & { payment_stage?: number })[];

  const totalCommission = won.reduce((s, d) => s + dealCommission(d), 0);
  const totalReceived = won.reduce((s, d) => s + received(d.payment_stage ?? 0, dealCommission(d)), 0);
  const outstanding = totalCommission - totalReceived;

  const owed = won.filter((d) => (d.payment_stage ?? 0) < 2);
  const paid = won.filter((d) => (d.payment_stage ?? 0) >= 2);

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold">Earnings</h1>
        <Link href="/" className="text-sm text-accent">Done</Link>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Card><p className="text-xs text-muted">Outstanding</p><p className="mt-1 text-lg font-semibold text-followup">{money(outstanding)}</p></Card>
        <Card><p className="text-xs text-muted">Received</p><p className="mt-1 text-lg font-semibold text-won">{money(totalReceived)}</p></Card>
        <Card><p className="text-xs text-muted">Total won</p><p className="mt-1 text-lg font-semibold">{money(totalCommission)}</p></Card>
      </div>

      {/* What you still need to collect */}
      <section className="flex flex-col gap-2">
        <SectionHeader title="Owed to you" count={owed.length} />
        {owed.length === 0 ? (
          <Card><p className="text-sm text-muted">All commissions collected. Nice. 💪</p></Card>
        ) : (
          owed.map((d) => {
            const stage = d.payment_stage ?? 0;
            const comm = dealCommission(d);
            const remaining = comm - received(stage, comm);
            const note = stage === 1 ? "2nd payment due (50%)" : "1st + 2nd due";
            const next = stage === 1 ? "Mark paid in full" : "Mark 1st 50% received";
            return (
              <Card key={d.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.client_name}</p>
                    <p className="text-xs text-muted">{note} · {shortDate(d.updated_at)}</p>
                  </div>
                  <p className="shrink-0 text-base font-semibold tabular-nums text-followup">{money(remaining)}</p>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <form action={setCommission} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={d.id} />
                    <span className="text-xs text-muted">Commission $</span>
                    <input name="commission" type="number" inputMode="decimal" defaultValue={d.commission ?? ""} placeholder={`${comm}`} className="w-20 rounded-lg px-2 py-1 text-sm" />
                    <button className="rounded-full border border-hairline px-2 py-1 text-xs text-text">Set</button>
                  </form>
                  <form action={cyclePayment}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="rounded-full bg-won/20 px-3 py-1.5 text-xs font-medium text-won">{next}</button>
                  </form>
                </div>
              </Card>
            );
          })
        )}
      </section>

      {/* Fully paid — tucked away */}
      {paid.length > 0 && (
        <details className="rounded-card border border-hairline bg-white/[0.04]">
          <summary className="cursor-pointer list-none p-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Paid in full · {paid.length}
          </summary>
          <div className="flex flex-col gap-2 border-t border-hairline p-3">
            {paid.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <span className="truncate text-muted">{d.client_name}</span>
                <span className="flex items-center gap-3">
                  <span className="text-won">{money(dealCommission(d))} ✓</span>
                  <form action={cyclePayment}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="text-xs text-muted">undo</button>
                  </form>
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </main>
  );
}
