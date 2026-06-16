import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { DoorWantLine, EngagementChips } from "@/components/DealMeta";
import { money } from "@/lib/format";
import { dealPriority, type Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DealsList() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("*")
    .order("updated_at", { ascending: false });

  // Most important deals on top by default (closed ones sink to the bottom).
  const deals = ((data ?? []) as Deal[]).sort(
    (a, b) => dealPriority(b) - dealPriority(a),
  );

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold">Deals</h1>
        <Link
          href="/deals/new"
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-bg"
        >
          + Add
        </Link>
      </header>

      {deals.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No deals yet. Tap <span className="text-accent">+ Add</span> to create
            your first one.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {deals.map((d) => (
            <Link key={d.id} href={`/deals/${d.id}`}>
              <Card className="active:bg-white/[0.05]">
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
                    <p className="mt-1 text-sm font-medium">
                      {money(d.quote_price)}
                    </p>
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
