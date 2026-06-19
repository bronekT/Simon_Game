import { Suspense } from "react";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/Card";
import { CoachReport as CoachReportView } from "@/components/CoachReport";
import { CoachTabs } from "@/components/CoachTabs";
import { ActionButton } from "@/components/ActionButton";
import { Mascot } from "@/components/Brand";
import { reviewMeeting } from "./actions";
import { shortDate } from "@/lib/format";
import { buildCoachBrief, generateCoachReport, type CoachAppt, type CoachReport } from "@/lib/ai/coach";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // the aggregate AI report can take ~45s on a refresh

const SKILLS: [string, string][] = [
  ["score_rapport", "Контакт"],
  ["score_discovery", "Выявление"],
  ["score_pain", "Боль / потребность"],
  ["score_product", "Презентация"],
  ["score_objection", "Возражения"],
  ["score_closing", "Закрытие"],
  ["score_followup", "Дожим"],
];

interface Row {
  occurred_at: string | null;
  talk_ratio: number | null;
  score_rapport: number | null;
  score_discovery: number | null;
  score_pain: number | null;
  score_product: number | null;
  score_objection: number | null;
  score_closing: number | null;
  score_followup: number | null;
}
function numField(a: Row, key: string): number | null {
  const v = (a as unknown as Record<string, number | null>)[key];
  return typeof v === "number" ? v : null;
}

// Cached AI report — re-generated only when the history changes (token), so the
// page is instant on repeat opens and re-analyzes with each new deal.
const getCoachReport = unstable_cache(
  async (userId: string, _token: string): Promise<CoachReport | null> => {
    const admin = createAdminClient();
    const { data: appts } = await admin
      .from("appointments")
      .select(
        "occurred_at, record_type, summary, score_rapport, score_discovery, score_pain, score_product, score_objection, score_closing, score_followup, analysis",
      )
      .eq("user_id", userId)
      .not("record_type", "is", null)
      .order("occurred_at", { ascending: true })
      .limit(60);
    const { data: outs } = await admin.from("outcomes").select("result").eq("user_id", userId);
    const wins = (outs ?? []).filter((o) => o.result === "won").length;
    const losses = (outs ?? []).filter((o) => o.result === "lost").length;

    const rows: CoachAppt[] = (appts ?? []).map((a) => {
      const an = (a.analysis ?? {}) as Record<string, unknown>;
      return {
        occurred_at: a.occurred_at as string | null,
        record_type: a.record_type as string | null,
        summary: a.summary as string | null,
        scores: {
          rapport: a.score_rapport as number | null,
          discovery: a.score_discovery as number | null,
          pain: a.score_pain as number | null,
          product: a.score_product as number | null,
          objection: a.score_objection as number | null,
          closing: a.score_closing as number | null,
          followup: a.score_followup as number | null,
        },
        outcome: (an.outcome as string) ?? null,
        what_went_well: (an.what_went_well as string) ?? null,
        what_went_wrong: (an.what_went_wrong as string) ?? null,
        top_objection: (Array.isArray(an.objections) ? (an.objections as string[])[0] : null) ?? null,
      };
    });
    if (rows.length === 0) return null;
    return generateCoachReport(buildCoachBrief(rows, wins, losses));
  },
  ["coach-report-v2"],
  { revalidate: 86400 },
);

export default async function Coach() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: apptData } = await supabase
    .from("appointments")
    .select(
      "occurred_at, talk_ratio, score_rapport, score_discovery, score_pain, score_product, score_objection, score_closing, score_followup",
    )
    .not("record_type", "is", null)
    .order("occurred_at", { ascending: true });
  const appts = (apptData ?? []) as Row[];

  // Meetings list (newest first) — each with its saved Russian review, if any.
  const { data: meetData } = await supabase
    .from("appointments")
    .select("id, occurred_at, created_at, record_type, summary, deal_id, deals(client_name), analysis")
    .not("record_type", "is", null)
    .neq("record_type", "note")
    .order("created_at", { ascending: false })
    .limit(60);
  const meetings: Meeting[] = (meetData ?? []).map((m) => ({
    id: m.id as string,
    date: (m.occurred_at as string) ?? (m.created_at as string),
    type: (m.record_type as string) ?? null,
    summary: (m.summary as string) ?? null,
    dealId: (m.deal_id as string) ?? null,
    client:
      (Array.isArray(m.deals) ? m.deals[0]?.client_name : (m.deals as { client_name?: string } | null)?.client_name) ?? null,
    review: ((m.analysis as Record<string, unknown> | null)?.ru_review as string) ?? null,
  }));

  const { data: outcomeData } = await supabase.from("outcomes").select("result");
  const outcomes = outcomeData ?? [];
  const won = outcomes.filter((o) => o.result === "won").length;
  const lost = outcomes.filter((o) => o.result === "lost").length;
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null;

  const avg = (key: string) => {
    const vals = appts.map((a) => numField(a, key)).filter((v): v is number => v != null);
    return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
  };
  const talk = avg("talk_ratio");

  // Overall trend: mean of the 7 skills per call, recent 5 vs the 5 before.
  const perCall = appts
    .map((a) => {
      const vs = SKILLS.map(([k]) => numField(a, k)).filter((v): v is number => v != null);
      return vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null;
    })
    .filter((v): v is number => v != null);
  const mean = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const recent5 = perCall.slice(-5);
  const prev5 = perCall.slice(-10, -5);
  const trend = recent5.length && prev5.length ? mean(recent5) - mean(prev5) : null;

  const token = `${appts.length}:${appts[appts.length - 1]?.occurred_at ?? ""}`;

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold">Коуч</h1>
        <Link href="/" className="text-sm text-accent">Готово</Link>
      </header>
      <p className="-mt-2 text-sm text-muted">
        Разбор по всей твоей истории — что помогает закрывать, что улучшить, и
        готовые фразы. Обновляется с каждой новой сделкой.
      </p>

      {appts.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <Mascot size={96} />
          <p className="max-w-xs text-sm text-muted">
            Пока нет разобранных встреч. Загрузи несколько транскриптов в{" "}
            <Link href="/capture" className="text-accent">Capture</Link> — и здесь
            появится твой персональный разбор и динамика.
          </p>
        </Card>
      ) : (
        <CoachTabs
          meetings={<MeetingsList meetings={meetings} />}
          overview={
            <>
          {/* Snapshot */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Разобрано" value={String(appts.length)} />
            <Stat label="Закрытие" value={winRate != null ? `${winRate}%` : "—"} />
            <Stat label="Ты говоришь" value={talk != null ? `${talk}%` : "—"} />
          </div>

          {/* Skills + trend */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold text-muted">Средние навыки (из 10)</p>
              {trend != null && (
                <span className={`text-xs font-semibold ${trend >= 0 ? "text-won" : "text-risk"}`}>
                  {trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)} к недавним
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2.5">
              {SKILLS.map(([k, label]) => {
                const v = avg(k);
                return (
                  <div key={k} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-xs text-muted">{label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${((v ?? 0) / 10) * 100}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs tabular-nums">{v ?? "—"}</span>
                  </div>
                );
              })}
            </div>
            {perCall.length >= 2 && (
              <div className="mt-3 border-t border-hairline pt-3">
                <p className="mb-1 text-[11px] text-muted">Динамика общего уровня (по встречам)</p>
                <Sparkline values={perCall} />
              </div>
            )}
          </Card>

          {/* AI report — streams in */}
          {user && (
            <Suspense fallback={<ReportSkeleton />}>
              <ReportSection userId={user.id} token={token} />
            </Suspense>
          )}
            </>
          }
        />
      )}
    </main>
  );
}

interface Meeting {
  id: string;
  date: string;
  type: string | null;
  summary: string | null;
  dealId: string | null;
  client: string | null;
  review: string | null;
}

const TYPE_RU: Record<string, string> = {
  appointment: "Встреча",
  booking_call: "Запись",
  followup_call: "Дожим",
};

// "По встречам": each meeting saved like a chat thread — open to read its detailed
// Russian review, or generate it once (then it's stored, free to re-read).
function MeetingsList({ meetings }: { meetings: Meeting[] }) {
  if (meetings.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">Пока нет встреч для разбора. Загрузи транскрипт в Capture.</p>
      </Card>
    );
  }
  return (
    <>
      <p className="px-1 text-[11px] text-muted">
        Детальный разбор каждой встречи на русском. Создаётся один раз и сохраняется — потом читается без затрат токенов.
      </p>
      {meetings.map((m) => (
        <details key={m.id} className="rounded-card border border-hairline bg-white/[0.04]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{m.client ?? "Без имени"}</span>
              {m.type && <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">{TYPE_RU[m.type] ?? m.type}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted">
              {m.review && <span className="text-won">✓ разобрано</span>}
              {shortDate(m.date)}
              <span>⌄</span>
            </span>
          </summary>
          <div className="border-t border-hairline p-3">
            {m.review ? (
              <p className="whitespace-pre-line text-sm leading-relaxed">{m.review}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {m.summary && <p className="text-sm text-muted">{m.summary}</p>}
                <form action={reviewMeeting}>
                  <input type="hidden" name="id" value={m.id} />
                  <ActionButton
                    pendingLabel="Разбираю встречу… (~30 сек)"
                    doneLabel="Готово ✓ — открой снова"
                    className="w-full rounded-full bg-accent/15 py-2.5 text-sm font-semibold text-accent"
                  >
                    🧠 Разобрать эту встречу детально
                  </ActionButton>
                </form>
              </div>
            )}
          </div>
        </details>
      ))}
    </>
  );
}

async function ReportSection({ userId, token }: { userId: string; token: string }) {
  const report = await getCoachReport(userId, token);
  if (!report) {
    return (
      <Card>
        <p className="text-sm text-muted">
          Разбор появится после следующей разобранной встречи. Загрузи ещё пару
          транскриптов — и коуч соберёт закономерности.
        </p>
      </Card>
    );
  }
  return <CoachReportView report={report} />;
}

// Tiny inline sparkline of the overall score per call (oldest → newest).
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 280;
  const h = 44;
  const max = 10;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [i * step, h - (Math.max(0, Math.min(max, v)) / max) * h]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" preserveAspectRatio="none">
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="currentColor" className="text-accent/10" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" className="fill-accent" />
    </svg>
  );
}

function ReportSkeleton() {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <Mascot size={48} />
        <p className="text-sm text-muted">Анализирую всю твою историю…</p>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {[90, 80, 95, 70].map((w, i) => (
          <div key={i} className="h-3 rounded-full shimmer" style={{ width: `${w}%` }} />
        ))}
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </Card>
  );
}
