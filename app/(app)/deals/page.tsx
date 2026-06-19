import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { SwipeDeal } from "@/components/SwipeDeal";
import { dealPriority, type Deal, type DealStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS: Record<string, string> = { hot: "🔥 Hot", value: "$ Value", newest: "Newest" };

// One-tap views — concentrate on what matters: who to chase vs who's only booked.
const VIEWS: { key: string; label: string; match: (s: DealStatus) => boolean }[] = [
  { key: "chase", label: "🔥 Дожать", match: (s) => ["met", "quoted", "negotiation"].includes(s) },
  { key: "booked", label: "📅 Назначено", match: (s) => ["booked", "new"].includes(s) },
  { key: "open", label: "Все", match: (s) => !["won", "lost", "dead"].includes(s) },
  { key: "won", label: "✅ Won", match: (s) => s === "won" },
  { key: "lost", label: "Lost", match: (s) => ["lost", "dead"].includes(s) },
];

export default async function DealsList({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; show?: string }>;
}) {
  const sp = await searchParams;
  const show = VIEWS.some((v) => v.key === sp.show) ? sp.show! : "open";
  const sort = sp.sort || (show === "chase" ? "hot" : "newest");

  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("*");
  const all = (data ?? []) as Deal[];

  const counts = Object.fromEntries(VIEWS.map((v) => [v.key, all.filter((d) => v.match(d.status)).length]));
  const active = VIEWS.find((v) => v.key === show)!;
  const deals = all.filter((d) => active.match(d.status));

  if (sort === "value") deals.sort((a, b) => (b.quote_price ?? 0) - (a.quote_price ?? 0));
  else if (sort === "hot") deals.sort((a, b) => dealPriority(b) - dealPriority(a));
  else deals.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

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

      {/* Segmented switcher — one tap between chase / booked / all / won */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {VIEWS.map((v) => {
          const on = v.key === show;
          return (
            <Link
              key={v.key}
              href={`/deals?show=${v.key}`}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                on ? "bg-accent-grad text-bg shadow-[0_6px_16px_-8px_rgba(233,162,59,0.7)]" : "border border-hairline text-muted"
              }`}
            >
              {v.label}
              <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${on ? "bg-black/15" : "bg-white/10"}`}>
                {counts[v.key]}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Sort — compact, tucked away */}
      <details className="-mt-1 rounded-card border border-hairline bg-white/[0.04]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs">
          <span className="text-muted">Sorted by <b className="text-text">{SORTS[sort]}</b></span>
          <span className="text-accent">change</span>
        </summary>
        <div className="flex flex-wrap gap-2 border-t border-hairline p-3">
          {Object.entries(SORTS).map(([k, label]) => (
            <Link
              key={k}
              href={`/deals?show=${show}&sort=${k}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${sort === k ? "bg-accent text-bg" : "border border-hairline text-muted"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </details>

      {deals.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-muted">
            {show === "chase"
              ? "Никого дожимать прямо сейчас. Проведи встречу — и дилы появятся здесь."
              : show === "booked"
                ? "Нет назначенных встреч. Забукай звонок в Capture."
                : "Nothing here yet. Tap + Add."}
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
