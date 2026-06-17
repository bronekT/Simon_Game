import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { money, TZ } from "@/lib/format";
import { dealCommission, type Deal } from "@/lib/types";
import { wonDates } from "@/lib/won";
import { cyclePayment, setCommission } from "./actions";

export const dynamic = "force-dynamic";

const MONTHLY_GOAL = 10_000;

function received(stage: number, c: number): number {
  if (stage >= 2) return c;
  if (stage === 1) return c * 0.5;
  return 0;
}

// "2026-06" key in the business timezone, for a won date.
function monthKey(iso: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(new Date(iso));
  const y = p.find((x) => x.type === "year")?.value ?? "";
  const m = p.find((x) => x.type === "month")?.value ?? "";
  return `${y}-${m}`;
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-CA", { timeZone: "UTC", month: "long", year: "numeric" });
}

export default async function Earnings() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("id, client_name, status, quote_price, commission, payment_stage, updated_at")
    .eq("status", "won")
    .order("updated_at", { ascending: false });
  const won = (data ?? []) as (Deal & { payment_stage?: number })[];

  // Stable won-date per deal (the month it was actually won — never drifts).
  const wonAt = await wonDates(supabase, won.map((d) => d.id));
  const wonDate = (d: Deal) => wonAt.get(d.id) ?? d.updated_at;

  const comm = (d: Deal & { payment_stage?: number }) => dealCommission(d);
  const totalCommission = won.reduce((s, d) => s + comm(d), 0);
  const totalReceived = won.reduce((s, d) => s + received(d.payment_stage ?? 0, comm(d)), 0);
  const outstanding = totalCommission - totalReceived;

  const await1st = won.filter((d) => (d.payment_stage ?? 0) === 0).length;
  const await2nd = won.filter((d) => (d.payment_stage ?? 0) === 1).length;
  const paidFull = won.filter((d) => (d.payment_stage ?? 0) >= 2).length;

  // This calendar month's commission (by won-date) vs the $10k goal.
  const thisKey = monthKey(new Date().toISOString());
  const thisMonthCommission = won.filter((d) => monthKey(wonDate(d)) === thisKey).reduce((s, d) => s + comm(d), 0);
  const goalPct = Math.min(100, Math.round((thisMonthCommission / MONTHLY_GOAL) * 100));

  // Group by month (newest first).
  const byMonth = new Map<string, (Deal & { payment_stage?: number })[]>();
  for (const d of won) {
    const k = monthKey(wonDate(d));
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k)!.push(d);
  }
  const months = [...byMonth.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold">Earnings</h1>
        <Link href="/" className="text-sm text-accent">Done</Link>
      </header>

      {/* This month vs $10k goal */}
      <Card>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted">Commission this month</p>
            <p className="mt-0.5 text-2xl font-semibold text-won">{money(thisMonthCommission)}</p>
          </div>
          <p className="text-xs text-muted">Goal {money(MONTHLY_GOAL)}</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-won" style={{ width: `${goalPct}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-muted">{goalPct}% of your {money(MONTHLY_GOAL)} monthly goal</p>
      </Card>

      {/* Compact summary table */}
      <div className="overflow-hidden rounded-card border border-hairline">
        <Stat label="Outstanding (still owed)" value={money(outstanding)} tone="followup" first />
        <Stat label="Received" value={money(totalReceived)} tone="won" />
        <Stat label="Total won (all time)" value={money(totalCommission)} />
        <div className="grid grid-cols-3 divide-x divide-hairline border-t border-hairline text-center">
          <Mini label="Await 1st" value={await1st} />
          <Mini label="Await 2nd" value={await2nd} />
          <Mini label="Paid full" value={paidFull} />
        </div>
      </div>

      {/* By month — newest first; each opens to that month's deals */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">By month</h2>
        {months.length === 0 ? (
          <Card><p className="text-sm text-muted">No won deals yet. Swipe a deal right to mark it Won.</p></Card>
        ) : (
          months.map((k) => {
            const ds = byMonth.get(k)!;
            const monthTotal = ds.reduce((s, d) => s + comm(d), 0);
            const monthOutstanding = ds.reduce((s, d) => s + (comm(d) - received(d.payment_stage ?? 0, comm(d))), 0);
            return (
              <details key={k} className="rounded-card border border-hairline bg-white/[0.04]" open={k === thisKey}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-sm font-medium">{monthLabel(k)}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-muted">{ds.length}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="text-sm font-semibold text-won">{money(monthTotal)}</span>
                    {monthOutstanding > 0 && <span className="ml-2 text-[11px] text-followup">{money(monthOutstanding)} owed</span>}
                  </span>
                </summary>
                <div className="divide-y divide-hairline border-t border-hairline">
                  {ds.map((d) => (
                    <DealRow key={d.id} d={d} />
                  ))}
                </div>
              </details>
            );
          })
        )}
      </section>
    </main>
  );
}

// One deal row: name, status, remaining, commission input, payment toggle.
function DealRow({ d }: { d: Deal & { payment_stage?: number } }) {
  const stage = d.payment_stage ?? 0;
  const c = dealCommission(d);
  const remaining = c - received(stage, c);
  const next = stage === 0 ? "Mark 1st 50%" : stage === 1 ? "Mark paid full" : "Undo";
  const statusLabel = stage >= 2 ? "Paid ✓" : stage === 1 ? "2nd due" : "Unpaid";
  const statusTone = stage >= 2 ? "text-won" : "text-followup";
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/deals/${d.id}`} className="min-w-0 flex-1 truncate text-sm font-medium active:text-accent">
          {d.client_name}
        </Link>
        <span className={`shrink-0 text-[11px] ${statusTone}`}>{statusLabel}</span>
        <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums">{money(remaining)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <form action={setCommission} className="flex items-center gap-1.5">
          <input type="hidden" name="id" value={d.id} />
          <span className="text-[11px] text-muted">$</span>
          <input
            name="commission"
            type="number"
            inputMode="decimal"
            defaultValue={d.commission ?? ""}
            placeholder={`${c}`}
            className="w-20 rounded-lg px-2 py-1 text-sm"
          />
          <button className="rounded-full border border-hairline px-2 py-1 text-[11px] text-text">Set</button>
        </form>
        <form action={cyclePayment}>
          <input type="hidden" name="id" value={d.id} />
          <button className="rounded-full bg-won/20 px-3 py-1.5 text-[11px] font-medium text-won">{next}</button>
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, first }: { label: string; value: string; tone?: "won" | "followup"; first?: boolean }) {
  const c = tone === "won" ? "text-won" : tone === "followup" ? "text-followup" : "text-text";
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 ${first ? "" : "border-t border-hairline"}`}>
      <span className="text-sm text-muted">{label}</span>
      <span className={`text-base font-semibold tabular-nums ${c}`}>{value}</span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-2.5">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
}
