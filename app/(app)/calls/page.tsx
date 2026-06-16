import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { DoorWantLine } from "@/components/DealMeta";
import { shortDate, TZ, torontoOffset } from "@/lib/format";
import { OPEN_STATUSES, type Deal } from "@/lib/types";
import { snoozeCall, clearCall } from "./actions";

export const dynamic = "force-dynamic";

export default async function Calls() {
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("*");
  const all = (data ?? []) as Deal[];
  const open = all.filter((d) => OPEN_STATUSES.includes(d.status));

  // End of "today" in Toronto, as an instant.
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const endOfTodayMs = Date.parse(`${todayStr}T23:59:59${torontoOffset()}`);

  const due = (d: Deal) =>
    d.followup_at != null && new Date(d.followup_at).getTime() <= endOfTodayMs;

  // 1) Call today: follow-ups due or overdue (overdue first).
  const callToday = open
    .filter(due)
    .sort((a, b) => (a.followup_at! < b.followup_at! ? -1 : 1));
  const usedIds = new Set(callToday.map((d) => d.id));

  // 2) New leads (never worked yet).
  const newLeads = open.filter((d) => d.status === "new" && !usedIds.has(d.id));
  newLeads.forEach((d) => usedIds.add(d.id));

  // 3) Going cold (flagged at-risk, not already listed).
  const goingCold = open.filter(
    (d) => (d as Deal & { at_risk?: boolean }).at_risk && !usedIds.has(d.id),
  );

  const total = callToday.length + newLeads.length + goingCold.length;

  return (
    <main className="flex flex-col gap-4">
      <header className="pt-2">
        <h1 className="text-2xl font-semibold">Calls</h1>
        <p className="mt-1 text-sm text-muted">
          Your call list for today — new leads, people you didn&apos;t reach, and
          due follow-ups. Nobody slips through.
        </p>
      </header>

      {total === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            All clear — no calls due. New leads and due follow-ups will appear here.
          </p>
        </Card>
      ) : (
        <>
          <CallSection title="📞 Call today" subtitle="due & overdue" deals={callToday} overdueMs={endOfTodayMs} />
          <CallSection title="🆕 New leads" subtitle="qualify & book a visit" deals={newLeads} />
          <CallSection title="⚠️ Going cold" subtitle="no activity 3+ days" deals={goingCold} />
        </>
      )}
    </main>
  );
}

function CallSection({
  title,
  subtitle,
  deals,
  overdueMs,
}: {
  title: string;
  subtitle: string;
  deals: Deal[];
  overdueMs?: number;
}) {
  if (deals.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted">
        {title} <span className="font-normal text-muted/70">· {deals.length} · {subtitle}</span>
      </h2>
      {deals.map((d) => (
        <CallRow key={d.id} deal={d} overdueMs={overdueMs} />
      ))}
    </section>
  );
}

function CallRow({ deal: d, overdueMs }: { deal: Deal; overdueMs?: number }) {
  const tel = (d.phone ?? "").replace(/[^\d+]/g, "");
  const overdue =
    overdueMs != null && d.followup_at != null && new Date(d.followup_at).getTime() < Date.now();

  return (
    <Card className="!p-3">
      <div className="flex items-center gap-3">
        <Link href={`/deals/${d.id}`} className="min-w-0 flex-1 active:opacity-70">
          <p className="truncate font-medium">{d.client_name}</p>
          <p className="mt-0.5 truncate text-sm">
            {d.door_type || d.door_count ? (
              <DoorWantLine type={d.door_type} count={d.door_count} />
            ) : (
              <span className="text-muted">{d.next_action ?? "New lead"}</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {d.phone ? d.phone : "no number"}
            {d.followup_at && (
              <span className={overdue ? "text-risk" : "text-followup"}> · due {shortDate(d.followup_at)}</span>
            )}
          </p>
        </Link>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {tel ? (
            <a
              href={`tel:${tel}`}
              className="flex items-center gap-1 rounded-full bg-won/20 px-3 py-1.5 text-sm font-semibold text-won active:scale-95"
            >
              📞 Call
            </a>
          ) : (
            <Link href={`/deals/${d.id}/edit`} className="rounded-full border border-hairline px-3 py-1.5 text-xs text-muted">
              Add number
            </Link>
          )}
          <div className="flex gap-1.5">
            <form action={snoozeCall}>
              <input type="hidden" name="id" value={d.id} />
              <button className="rounded-full border border-hairline px-2.5 py-1 text-[11px] text-muted">No answer · 1d</button>
            </form>
            <form action={clearCall}>
              <input type="hidden" name="id" value={d.id} />
              <button className="rounded-full border border-hairline px-2.5 py-1 text-[11px] text-won">Reached ✓</button>
            </form>
          </div>
        </div>
      </div>
    </Card>
  );
}
