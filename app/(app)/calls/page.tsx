import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { DoorWantLine } from "@/components/DealMeta";
import { dateTime } from "@/lib/format";
import type { DoorType } from "@/lib/types";

export const dynamic = "force-dynamic";

interface CallRow {
  id: string;
  record_type: string | null;
  created_at: string;
  summary: string | null;
  client_name: string;
  door_type: DoorType | null;
  door_count: number | null;
  address: string | null;
  event: { start?: string; location?: string } | null;
  dealId: string | null;
}

const LABEL: Record<string, string> = {
  booking_call: "Booking call",
  followup_call: "Follow-up call",
};

export default async function Calls() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("id, record_type, created_at, summary, analysis, deal_id, deals(client_name, door_type, door_count, address)")
    .in("record_type", ["booking_call", "followup_call"])
    .order("created_at", { ascending: false })
    .limit(40);

  const calls: CallRow[] = (data ?? []).map((a) => {
    const deal = Array.isArray(a.deals) ? a.deals[0] : (a.deals as Record<string, unknown> | null);
    const ev = (a.analysis as { proposed_event?: { start?: string; location?: string } } | null)?.proposed_event ?? null;
    return {
      id: a.id as string,
      record_type: a.record_type as string | null,
      created_at: a.created_at as string,
      summary: a.summary as string | null,
      client_name: (deal?.client_name as string) ?? "Unknown",
      door_type: (deal?.door_type as DoorType) ?? null,
      door_count: (deal?.door_count as number) ?? null,
      address: (deal?.address as string) ?? null,
      event: ev,
      dealId: (a.deal_id as string) ?? null,
    };
  });

  return (
    <main className="flex flex-col gap-4">
      <header className="pt-2">
        <h1 className="text-2xl font-semibold">Calls</h1>
        <p className="mt-1 text-sm text-muted">
          Every call you captured — what it was about, what doors, and when you booked.
        </p>
      </header>

      {calls.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No calls yet. When you capture a phone call in <b className="text-text">Capture</b>{" "}
            (or it arrives from your recorder), it shows up here.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {calls.map((c) => {
            const booked = c.event?.start;
            const where = c.event?.location || c.address;
            const inner = (
              <Card className="!p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-task/15 px-2 py-0.5 text-[11px] font-medium text-task">
                    {c.record_type ? LABEL[c.record_type] ?? c.record_type : "Call"}
                  </span>
                  <span className="text-[11px] text-muted">{dateTime(c.created_at)}</span>
                </div>

                <p className="mt-2 font-semibold">{c.client_name}</p>
                {(c.door_type || c.door_count) && (
                  <p className="mt-0.5 text-sm">
                    <DoorWantLine type={c.door_type} count={c.door_count} />
                  </p>
                )}
                {c.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{c.summary}</p>}

                {booked && (
                  <div className="mt-2 rounded-xl border border-won/30 bg-won/5 px-3 py-2 text-xs">
                    <span className="text-won">📅 Booked</span> · {dateTime(booked)}
                    {where && <span className="text-muted"> · 📍 {where}</span>}
                  </div>
                )}
              </Card>
            );
            return c.dealId ? (
              <Link key={c.id} href={`/deals/${c.dealId}`}>{inner}</Link>
            ) : (
              <div key={c.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </main>
  );
}
