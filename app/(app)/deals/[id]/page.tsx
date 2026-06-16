import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { DoorWantLine, EngagementChips } from "@/components/DealMeta";
import { StatusSelect } from "@/components/StatusSelect";
import { SubmitButton } from "@/components/SubmitButton";
import { ActionsInline, type QueueAction } from "@/components/ApproveList";
import { PendingOverlay } from "@/components/PendingOverlay";
import { processTranscript } from "@/app/(app)/capture/actions";
import { bumpFollowups, deleteDeal, generateFollowups } from "./quick-actions";
import { money, titleCase, dateTime, shortDate } from "@/lib/format";
import { DOOR_LABELS, type Deal } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // allow background "update this client" to finish

interface Appointment {
  id: string;
  created_at: string;
  record_type: string | null;
  location_type: string | null;
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
    coaching?: { situation?: string; better?: string; technique?: string }[];
    objections?: string[];
    budget_signal?: string | null;
    personal_hooks?: string[];
    proposed_event?: { title?: string; start?: string; location?: string } | null;
  } | null;
  needs_review: boolean;
}

const RECORD_LABEL: Record<string, string> = {
  booking_call: "Booking call",
  appointment: "Appointment",
  followup_call: "Follow-up call",
  note: "Note",
};
const LOCATION_LABEL: Record<string, string> = {
  home: "At home",
  showroom: "Showroom",
  phone: "Phone",
  virtual: "Virtual",
};

export default async function DealDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ analyzed?: string; error?: string; processing?: string }>;
}) {
  const { id } = await params;
  const { analyzed, error, processing } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const deal = data as Deal;

  // All appointments for this deal, oldest → newest (the timeline / history).
  const { data: apptRows } = await supabase
    .from("appointments")
    .select("*")
    .eq("deal_id", id)
    .order("created_at", { ascending: true });
  const appts = (apptRows ?? []) as Appointment[];
  // The meeting is the centerpiece: latest real appointment, else latest record.
  const meeting =
    [...appts].reverse().find((a) => a.record_type === "appointment") ??
    (appts.length ? appts[appts.length - 1] : null);
  const appt = meeting;

  // This deal's pending actions (approve / add to calendar right here).
  const { data: actRows } = await supabase
    .from("actions_queue")
    .select("id, kind, payload, status, retries")
    .eq("deal_id", id)
    .eq("status", "proposed")
    .order("created_at", { ascending: true });
  const actions: QueueAction[] = (actRows ?? []).map((a) => ({
    id: a.id as string,
    kind: a.kind as QueueAction["kind"],
    payload: (a.payload ?? {}) as Record<string, string | null>,
    status: a.status as string,
    retries: (a.retries as number) ?? 0,
    client_name: deal.client_name,
  }));

  return (
    <main className="flex flex-col gap-4">
      <header className="pt-2">
        <div className="flex items-center justify-between">
          <Link href="/deals" className="text-sm text-accent">
            ← Deals
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={`/deals/${deal.id}/edit`}
              className="rounded-full border border-hairline px-3 py-1 text-xs font-medium text-text active:bg-white/10"
            >
              ✎ Edit
            </Link>
            <details className="relative">
              <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full border border-hairline text-muted">
                ⋯
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-44 rounded-card border border-hairline bg-bg p-2 shadow-xl">
                <form action={deleteDeal}>
                  <input type="hidden" name="id" value={deal.id} />
                  <button className="w-full rounded-lg bg-risk/15 px-3 py-2 text-sm font-medium text-risk">
                    Delete lead
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{deal.client_name}</h1>
          <StatusSelect id={deal.id} status={deal.status} />
        </div>
        {(deal.door_type || deal.door_count) && (
          <p className="mt-1.5 text-sm">
            <DoorWantLine type={deal.door_type} count={deal.door_count} />
          </p>
        )}
        {deal.next_action && (
          <p className="mt-1 text-sm text-muted">{deal.next_action}</p>
        )}
        <EngagementChips deal={deal} className="mt-3" />

        {/* Follow-up counter: how many of ~3 follow-ups you've done */}
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-muted">Follow-ups</span>
          <form action={bumpFollowups}>
            <input type="hidden" name="id" value={deal.id} />
            <input type="hidden" name="delta" value="-1" />
            <button className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline text-muted active:scale-90">−</button>
          </form>
          <span className="text-sm font-semibold">{deal.followups_count ?? 0}<span className="text-muted">/3</span></span>
          <form action={bumpFollowups}>
            <input type="hidden" name="id" value={deal.id} />
            <input type="hidden" name="delta" value="1" />
            <button className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline text-accent active:scale-90">+</button>
          </form>
        </div>
      </header>

      {processing && (
        <Card className="border-task/40">
          <p className="text-sm text-task">Analyzing in the background… refresh in ~15s.</p>
        </Card>
      )}
      {analyzed && (
        <Card className="border-won/40">
          <p className="text-sm text-won">Updated from your input ✓</p>
        </Card>
      )}
      {error && (
        <Card className="border-risk/40">
          <p className="text-sm text-risk">{error}</p>
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
            <span className="text-xs text-muted">{dateTime(appt.created_at)}</span>
          </div>

          <Card>
            <div className="mb-2 flex flex-wrap gap-2 text-xs">
              {appt.record_type && (
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 font-medium text-accent">
                  {RECORD_LABEL[appt.record_type] ?? titleCase(appt.record_type)}
                </span>
              )}
              {appt.location_type && (
                <span className="rounded-full bg-task/15 px-2.5 py-0.5 font-medium text-task">
                  {LOCATION_LABEL[appt.location_type] ?? titleCase(appt.location_type)}
                </span>
              )}
            </div>
            {appt.summary && <p className="text-sm">{appt.summary}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {appt.sentiment && <Pill>Sentiment: {appt.sentiment}</Pill>}
              {appt.analysis?.budget_signal && <Pill>Budget: {appt.analysis.budget_signal}</Pill>}
            </div>
            {appt.talk_ratio != null && <TalkBar you={appt.talk_ratio} />}
          </Card>

          {/* Proposed meeting (booking calls / next visits) */}
          {appt.analysis?.proposed_event?.start && (
            <Card className="border-task/30">
              <p className="text-xs font-semibold text-task">Proposed meeting</p>
              <p className="mt-1 text-sm">{appt.analysis.proposed_event.title ?? "Visit"}</p>
              <p className="mt-0.5 text-xs text-muted">
                {dateTime(appt.analysis.proposed_event.start)}
                {appt.analysis.proposed_event.location
                  ? ` · ${appt.analysis.proposed_event.location}`
                  : ""}
              </p>
              <p className="mt-2 text-xs text-muted">
                Confirm it below in <span className="text-accent">Follow-ups &amp; actions</span> to add it to your calendar.
              </p>
            </Card>
          )}

          {/* Objections + personal hooks */}
          {((appt.analysis?.objections?.length ?? 0) > 0 ||
            (appt.analysis?.personal_hooks?.length ?? 0) > 0) && (
            <Card>
              {(appt.analysis?.objections?.length ?? 0) > 0 && (
                <div className="mb-3">
                  <p className="mb-1.5 text-xs font-semibold text-risk">Objections</p>
                  <div className="flex flex-wrap gap-2">
                    {appt.analysis!.objections!.map((o, i) => (
                      <span key={i} className="rounded-full bg-risk/10 px-2.5 py-0.5 text-xs text-text">{o}</span>
                    ))}
                  </div>
                </div>
              )}
              {(appt.analysis?.personal_hooks?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-accent">Personal hooks</p>
                  <div className="flex flex-wrap gap-2">
                    {appt.analysis!.personal_hooks!.map((h, i) => (
                      <span key={i} className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs text-text">{h}</span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          <ScoreGrid appt={appt} />

          {appt.analysis?.what_went_well && (
            <Disclosure title="What went well" tone="won">
              {appt.analysis.what_went_well}
            </Disclosure>
          )}
          {appt.analysis?.what_went_wrong && (
            <Disclosure title="To improve" tone="risk">
              {appt.analysis.what_went_wrong}
            </Disclosure>
          )}
          {appt.analysis?.coach_note && (
            <Disclosure title="Coach summary" tone="accent">
              <span className="whitespace-pre-line">{appt.analysis.coach_note}</span>
            </Disclosure>
          )}

          {/* Detailed per-lead coaching: exact phrasing + technique */}
          {(appt.analysis?.coaching?.length ?? 0) > 0 && (
            <Disclosure title="How to play it next time" tone="accent">
              <div className="flex flex-col gap-3 text-left">
                {appt.analysis!.coaching!.map((c, i) => (
                  <div key={i} className="border-l-2 border-accent/40 pl-3">
                    {c.situation && <p className="text-xs text-muted">{c.situation}</p>}
                    {c.better && (
                      <p className="mt-1 text-sm text-text">
                        <span className="text-won">Try: </span>
                        <span className="italic">“{c.better}”</span>
                      </p>
                    )}
                    {c.technique && (
                      <span className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
                        {c.technique}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Disclosure>
          )}

          <Link
            href={`/deals/${deal.id}/coaching`}
            className="rounded-card border border-accent/40 bg-accent/10 p-3 text-center text-sm font-medium text-accent active:scale-[0.99]"
          >
            Detailed coaching breakdown →
          </Link>
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

      {/* Follow-ups & actions — approve / add to calendar right here */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Follow-ups &amp; actions</h2>
          <form action={generateFollowups}>
            <input type="hidden" name="id" value={deal.id} />
            <button className="rounded-full border border-accent/50 px-3 py-1 text-xs font-medium text-accent active:scale-95">
              Generate
            </button>
          </form>
        </div>
        {actions.length > 0 ? (
          <ActionsInline actions={actions} />
        ) : (
          <Card>
            <p className="text-sm text-muted">
              No pending email / SMS / calendar items. Tap <b className="text-accent">Generate</b>{" "}
              to draft close-oriented follow-ups, or approved ones live in <b>To approve</b>.
            </p>
          </Card>
        )}
      </section>

      {/* History timeline — every capture, meeting stays at the top */}
      {appts.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">History</h2>
          {[...appts].reverse().map((a) => (
            <details key={a.id} className="rounded-card border border-hairline bg-white/[0.04]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                    {a.record_type ? RECORD_LABEL[a.record_type] ?? titleCase(a.record_type) : "Capture"}
                  </span>
                  <span className="truncate text-xs text-muted">{shortDate(a.created_at)}</span>
                </span>
                <span className="text-muted">⌄</span>
              </summary>
              <div className="px-3 pb-3 text-sm text-muted">
                {a.summary || "No summary."}
                {a.talk_ratio != null && (
                  <span className="mt-1 block text-xs">You spoke {a.talk_ratio}%</span>
                )}
              </div>
            </details>
          ))}
        </section>
      )}

      {/* Details — collapsed by default */}
      <details className="rounded-card border border-hairline bg-white/[0.04]">
        <summary className="flex cursor-pointer list-none items-center justify-between p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Details</span>
          <span className="text-muted transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <dl className="flex flex-col divide-y divide-hairline px-4 pb-3">
          <Row label="Door type" value={deal.door_type ? DOOR_LABELS[deal.door_type] : "—"} />
          <Row label="Quantity" value={deal.door_count != null ? `${deal.door_count}` : "—"} />
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
      </details>

      {/* Update this deal from a new transcript, screenshot, or file */}
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-muted">Update this client</h2>
        <p className="mb-3 text-xs text-muted">
          New call transcript, a screenshot of their text/email, or a file. The AI
          re-reads it and updates the status, follow-up, and proposed actions.
        </p>
        <form action={processTranscript} className="flex flex-col gap-3">
          <input type="hidden" name="deal_id" value={deal.id} />
          <input type="hidden" name="back_to" value={`/deals/${deal.id}`} />
          <textarea
            name="transcript"
            rows={3}
            placeholder="Paste new transcript / note (optional if attaching a file)…"
            className="w-full resize-y px-3 py-2.5 text-sm"
          />
          <input
            type="file"
            name="file"
            accept="image/*,.txt,.md,text/plain"
            className="w-full rounded-xl border border-hairline bg-white/[0.04] px-3 py-2 text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-1 file:text-bg"
          />
          <SubmitButton pendingLabel="Updating…">Update from this</SubmitButton>
          <PendingOverlay label="Updating this client…" />
        </form>
      </Card>
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

  const title =
    appt.record_type === "appointment"
      ? "Appointment scores (/10)"
      : appt.record_type === "followup_call"
        ? "Follow-up call scores (/10)"
        : "Call scores (/10)";

  return (
    <Card>
      <p className="mb-3 text-xs font-semibold text-muted">{title}</p>
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

// Collapsible card — tap the title to expand.
function Disclosure({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "won" | "risk" | "accent";
  children: React.ReactNode;
}) {
  const toneClass = tone === "won" ? "text-won" : tone === "risk" ? "text-risk" : "text-accent";
  return (
    <details className="group rounded-card border border-hairline bg-white/[0.02]">
      <summary className="flex cursor-pointer list-none items-center justify-between p-4">
        <span className={`text-sm font-semibold ${toneClass}`}>{title}</span>
        <span className="text-muted transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="px-4 pb-4 text-sm text-muted">{children}</div>
    </details>
  );
}

// Two-colour bar showing who spoke more (you vs the client).
function TalkBar({ you }: { you: number }) {
  const me = Math.max(0, Math.min(100, you));
  const client = 100 - me;
  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-accent">You {me}%</span>
        <span className="text-task">Client {client}%</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-accent" style={{ width: `${me}%` }} />
        <div className="h-full bg-task" style={{ width: `${client}%` }} />
      </div>
    </div>
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
