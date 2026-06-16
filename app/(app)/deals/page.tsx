import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { DoorWantLine, EngagementChips } from "@/components/DealMeta";
import { money } from "@/lib/format";
import { dealPriority, type Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS = [
  ["hot", "🔥 Hot"],
  ["value", "$ Value"],
  ["recent", "Newest"],
] as const;
const SHOWS = [
  ["open", "Open"],
  ["all", "All"],
  ["won", "Won"],
  ["lost", "Lost"],
] as const;

export default async function DealsList({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; show?: string }>;
}) {
  const { sort = "hot", show = "open" } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("*");
  let deals = (data ?? []) as Deal[];

  // Filter
  if (show === "open") deals = deals.filter((d) => !["won", "lost", "dead"].includes(d.status));
  else if (show === "won") deals = deals.filter((d) => d.status === "won");
  else if (show === "lost") deals = deals.filter((d) => ["lost", "dead"].includes(d.status));

  // Sort
  if (sort === "value") deals.sort((a, b) => (b.quote_price ?? 0) - (a.quote_price ?? 0));
  else if (sort === "recent") deals.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  else deals.sort((a, b) => dealPriority(b) - dealPriority(a));

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-accent text-bg" : "border border-hairline text-muted"}`;

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold">Deals</h1>
        <Link href="/deals/new" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-bg">
          + Add
        </Link>
      </header>

      {/* Filter + sort */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {SHOWS.map(([k, label]) => (
            <Link key={k} href={`/deals?show=${k}&sort=${sort}`} className={pill(show === k)}>
              {label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {SORTS.map(([k, label]) => (
            <Link key={k} href={`/deals?show=${show}&sort=${k}`} className={pill(sort === k)}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      {deals.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Nothing here. Tap <span className="text-accent">+ Add</span> or change the filter.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {deals.map((d) => (
            <Link key={d.id} href={`/deals/${d.id}`}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.client_name}</p>
                    <p className="mt-0.5 truncate text-sm">
                      <DoorWantLine type={d.door_type} count={d.door_count} />
                      {!d.door_type && !d.door_count && (
                        <span className="text-muted">{d.address ?? "No details yet"}</span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status={d.status} />
                    <p className="mt-1 text-sm font-medium">{money(d.quote_price)}</p>
                  </div>
                </div>
                <EngagementChips deal={d} className="mt-3" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
