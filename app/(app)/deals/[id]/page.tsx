import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { DraftCard } from "@/components/DraftCard";
import { money, titleCase, dateTime, shortDate } from "@/lib/format";
import type { Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Appointment {
  id: string;
  created_at: string;
  record_type: string | null;
  summary: string | null;
  sentiment: string | null;
  talk_ratio: number | null;
  score_rapport: number | null;
  score_discovery: number | null;
  score_pain: number | null;
  score_product: number | null;
  score_objection: number | null;
  score_closing: number | null;
  score_followup: number | null;
  analysis: {
    what_went_well?: string;
    what_went_wrong?: string;
    coach_note?: string;
    objections?: string[];
    budget_signal?: string | null;
  } | null;
  needs_review: boolean;
}

interface DraftRow {
  id: string;
  type: string | null;
  channel: string | null;
  subject: string | null;
  body: string;
}

export default async function DealDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ analyzed?: string }>;
}) {
  const { id } = await params;
  const { analyzed } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const deal = data as Deal;

  const { data: apptRow } = await supabase
    .from("appointments")
    .select("*")
    .eq("deal_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const appt = apptRow as Appointment | null;

  const { data: draftRows } = await supabase
    .from("drafts")
    .select("id, type, channel, subject, body")
    .eq("deal_id", id)
    .order("id", { ascending: true });
  const drafts = (draftRows ?? []) as DraftRow[];

  return (
    <main className="flex flex-col gap-5">
      <header className="pt-2">
        <Link href="/deals" className="text-sm text-accent">
          ← Deals
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{deal.client_name}</h1>
          <StatusBadge status={deal.status} />
        </div>
        {deal.next_action && (
          <p className="mt-1 text-sm text-muted">{deal.next_action}</p>
        )}
      </header>

      {analyzed && (
        <Card className="border-won/40">
          <p className="text-sm text-won">Transcript analyzed ✓</p>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Quote" value={money(deal.quote_price)} />
        <Stat
          label="Probability"
          value={deal.probability != null ? `${deal.probability}%` : "—"}
        />
        <Stat label="Follow up" value={shortDate(deal.followup_at)} />
      </div>

      {/* AI analysis */}
      {appt ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">AI Analysis</h2>
            <span className="text-xs text-muted">
              {titleCase(appt.record_type)} · {dateTime(appt.created_at)}
            </span>
          </div>

          <Card>
            {appt.summary && <p className="text-sm">{appt.summary}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {appt.sentiment && (
                <Pill>Sentiment: {appt.sentiment}</Pill>
              )}
              {appt.talk_ratio != null && (
                <Pill>You spoke {appt.talk_ratio}%</Pill>
              )}
            </div>
          </Card>

          <ScoreGrid appt={appt} />

          {(appt.analysis?.what_went_well || appt.analysis?.what_went_wrong) && (
            <Card>
              {appt.analysis?.what_went_well && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-won">What went well</p>
                  <p className="mt-1 text-sm text-muted">
                    {appt.analysis.what_went_well}
                  </p>
                </div>
              )}
              {appt.analysis?.what_went_wrong && (
                <div>
                  <p className="text-xs font-semibold text-risk">To improve</p>
                  <p className="mt-1 text-sm text-muted">
                    {appt.analysis.what_went_wrong}
                  </p>
                </div>
              )}
              {appt.analysis?.coach_note && (
                <p className="mt-3 border-t border-hairline pt-3 text-sm italic text-muted">
                  Coach: {appt.analysis.coach_note}
                </p>
              )}
            </Card>
          )}
        </section>
      ) : (
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-muted">AI Analysis</h2>
          <p className="text-sm text-muted">
            No transcript analyzed yet.{" "}
            <Link href="/capture" className="text-accent">
              Capture one
            </Link>{" "}
            to generate analysis and follow-ups.
          </p>
        </Card>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Draft follow-ups</h2>
          {drafts.map((d) => (
            <DraftCard
              key={d.id}
              type={d.type}
              channel={d.channel}
              subject={d.subject}
              body={d.body}
            />
          ))}
        </section>
      )}

      {/* Details */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-muted">Details</h2>
        <dl className="flex flex-col divide-y divide-hairline">
          <Row label="Service" value={titleCase(deal.service_type)} />
          <Row label="Lead source" value={titleCase(deal.lead_source)} />
          <Row label="Location" value={titleCase(deal.location_type)} />
          <Row label="Phone" value={deal.phone ?? "—"} />
          <Row label="Email" value={deal.email ?? "—"} />
          <Row label="Address" value={deal.address ?? "—"} />
          <Row label="Decision maker" value={deal.decision_maker ?? "—"} />
          <Row label="Competitor" value={deal.competitor ?? "—"} />
          <Row label="Main objection" value={deal.main_objection ?? "—"} />
          <Row label="Created" value={dateTime(deal.created_at)} />
        </dl>
      </Card>

      <Link
        href="/capture"
        className="rounded-full border border-hairline py-3 text-center font-medium text-text active:bg-white/10"
      >
        Analyze a transcript
      </Link>
    </main>
  );
}

function ScoreGrid({ appt }: { appt: Appointment }) {
  const scores: { label: string; value: number | null }[] = [
    { label: "Rapport", value: appt.score_rapport },
    { label: "Discovery", value: appt.score_discovery },
    { label: "Pain", value: appt.score_pain },
    { label: "Product", value: appt.score_product },
    { label: "Objection", value: appt.score_objection },
    { label: "Closing", value: appt.score_closing },
    { label: "Follow-up", value: appt.score_followup },
  ];
  if (scores.every((s) => s.value == null)) return null;

  return (
    <Card>
      <p className="mb-3 text-xs font-semibold text-muted">Call scores (/10)</p>
      <div className="flex flex-col gap-2.5">
        {scores.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-muted">{s.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${((s.value ?? 0) / 10) * 100}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-xs">
              {s.value ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-muted">
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm">{value}</dd>
    </div>
  );
}
