import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { money, titleCase } from "@/lib/format";
import type { Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DealsList() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("*")
    .order("updated_at", { ascending: false });

  const deals = (data ?? []) as Deal[];

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
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {[titleCase(d.service_type), d.address]
                        .filter((x) => x && x !== "—")
                        .join(" · ") || "No details yet"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status={d.status} />
                    <p className="mt-1 text-sm font-medium">
                      {money(d.quote_price)}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
