import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { SwipeDeal } from "@/components/SwipeDeal";
import { dealPriority, type Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS: Record<string, string> = { newest: "Newest", hot: "🔥 Hot", value: "$ Value" };
const SHOWS: Record<string, string> = { open: "Open", all: "All", won: "Won", lost: "Lost" };

export default async function DealsList({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; show?: string }>;
}) {
  const { sort = "newest", show = "open" } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("*");
  let deals = (data ?? []) as Deal[];

  if (show === "open") deals = deals.filter((d) => !["won", "lost", "dead"].includes(d.status));
  else if (show === "won") deals = deals.filter((d) => d.status === "won");
  else if (show === "lost") deals = deals.filter((d) => ["lost", "dead"].includes(d.status));

  if (sort === "value") deals.sort((a, b) => (b.quote_price ?? 0) - (a.quote_price ?? 0));
  else if (sort === "hot") deals.sort((a, b) => dealPriority(b) - dealPriority(a));
  else deals.sort((a, b) => b.updated_at.localeCompare(a.updated_at)); // newest

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-accent text-bg" : "border border-hairline text-muted"}`;

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
        <Link
          href="/deals/new"
          className="rounded-full bg-accent-grad px-4 py-2 text-sm font-semibold text-bg shadow-[0_6px_18px_-8px_rgba(233,162,59,0.7)] transition active:scale-95"
        >
          + Add
        </Link>
      </header>

      {/* Compact filters — collapsed by default, tap to change */}
      <details className="rounded-card border border-hairline bg-white/[0.05]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs">
          <span className="text-muted">
            Showing <b className="text-text">{SHOWS[show]}</b> · sorted by{" "}
            <b className="text-text">{SORTS[sort]}</b>
          </span>
          <span className="text-accent">change</span>
        </summary>
        <div className="flex flex-col gap-2 border-t border-hairline p-3">
          <div className="flex flex-wrap gap-2">
            {Object.entries(SHOWS).map(([k, label]) => (
              <Link key={k} href={`/deals?show=${k}&sort=${sort}`} className={pill(show === k)}>{label}</Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SORTS).map(([k, label]) => (
              <Link key={k} href={`/deals?show=${show}&sort=${k}`} className={pill(sort === k)}>{label}</Link>
            ))}
          </div>
        </div>
      </details>

      {deals.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Nothing here. Tap <span className="text-accent">+ Add</span> or change the filter.
          </p>
        </Card>
      ) : (
        <>
          <p className="-mb-1 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted">
            <span className="text-risk">← Lost</span>
            <span className="opacity-50">·</span>
            <span>swipe a card</span>
            <span className="opacity-50">·</span>
            <span className="text-won">Won →</span>
          </p>
          <div className="flex flex-col gap-3">
            {deals.map((d) => (
              <SwipeDeal key={d.id} deal={d} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
