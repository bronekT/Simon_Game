import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { DealCard } from "@/components/DealCard";
import { SectionHeader } from "@/components/SectionHeader";
import type { Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

// Calls = the calling / qualifying / booking stage. New leads to phone, and
// leads you've booked but not yet met. Once a real appointment happens the deal
// moves on to Deals — it does not live here.
export default async function Calls() {
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("*");
  const all = (data ?? []) as Deal[];

  const toCall = all
    .filter((d) => d.status === "new")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const booked = all
    .filter((d) => d.status === "booked")
    .sort((a, b) => (a.followup_at ?? a.updated_at).localeCompare(b.followup_at ?? b.updated_at));

  const empty = toCall.length === 0 && booked.length === 0;

  return (
    <main className="flex flex-col gap-5">
      <header className="pt-2">
        <h1 className="text-2xl font-semibold">Calls</h1>
        <p className="mt-1 text-sm text-muted">
          Leads to call and qualify — book them into a showroom or home visit.
        </p>
      </header>

      {empty ? (
        <Card>
          <p className="text-sm text-muted">
            No leads to call right now. New leads land here; once you book a visit
            they move to <b className="text-text">Booked</b>, then to Deals after
            the meeting.
          </p>
        </Card>
      ) : (
        <>
          <section className="flex flex-col gap-2.5">
            <SectionHeader title="To call" count={toCall.length} />
            {toCall.length === 0 ? (
              <p className="text-sm text-muted">Nothing new to call.</p>
            ) : (
              toCall.map((d) => <DealCard key={d.id} deal={d} />)
            )}
          </section>

          {booked.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <SectionHeader title="Booked — upcoming visits" count={booked.length} />
              {booked.map((d) => (
                <DealCard key={d.id} deal={d} showFollowup />
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
