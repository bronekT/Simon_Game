import { Suspense } from "react";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/Card";
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
  ["coach-report-v1"],
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
        <Card>
          <p className="text-sm text-muted">
            Пока нет разобранных встреч. Загрузи несколько транскриптов в{" "}
            <Link href="/capture" className="text-accent">Capture</Link> — и здесь
            появится твой персональный разбор и динамика.
          </p>
        </Card>
      ) : (
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
          </Card>

          {/* AI report — streams in */}
          {user && (
            <Suspense fallback={<ReportSkeleton />}>
              <ReportSection userId={user.id} token={token} />
            </Suspense>
          )}
        </>
      )}
    </main>
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
  return (
    <div className="flex flex-col gap-4">
      {report.progress && (
        <Section title="📈 Твой прогресс" tone="accent">
          <p className="whitespace-pre-line text-sm leading-relaxed">{report.progress}</p>
        </Section>
      )}

      {report.strengths.length > 0 && (
        <Section title="💪 Что помогает тебе закрывать" tone="won">
          <BulletList items={report.strengths} marker="✓" markerClass="text-won" />
        </Section>
      )}

      {report.improve.length > 0 && (
        <Section title="🎯 Над чем поработать" tone="followup">
          <BulletList items={report.improve} marker="→" markerClass="text-followup" />
        </Section>
      )}

      {report.phrases.length > 0 && (
        <Section title="💬 Фразы, которые стоит использовать" tone="accent">
          <div className="flex flex-col gap-2.5">
            {report.phrases.map((p, i) => (
              <div key={i} className="rounded-xl border border-hairline bg-white/[0.03] p-3">
                {p.when && <p className="mb-1 text-[11px] uppercase tracking-wide text-muted">{p.when}</p>}
                <p className="text-sm italic text-text">«{p.say}»</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {report.tricks.length > 0 && (
        <Section title="🎩 Твои приёмы и техники" tone="accent">
          <div className="flex flex-col gap-2.5">
            {report.tricks.map((t, i) => (
              <div key={i} className="border-l-2 border-accent/40 pl-3">
                {t.name && <p className="text-sm font-semibold text-accent">{t.name}</p>}
                {t.how && <p className="mt-0.5 text-sm text-muted">{t.how}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {report.product_tips.length > 0 && (
        <Section title="🚪 Фишки по продукту" tone="won">
          <BulletList items={report.product_tips} marker="•" markerClass="text-won" />
        </Section>
      )}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="text-lg">🧠</span>
        <p className="text-sm text-muted">Анализирую всю твою историю…</p>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {[90, 80, 95, 70].map((w, i) => (
          <div key={i} className="h-3 animate-pulse rounded-full bg-white/[0.06]" style={{ width: `${w}%` }} />
        ))}
      </div>
    </Card>
  );
}

function Section({ title, tone, children }: { title: string; tone: "won" | "followup" | "accent"; children: React.ReactNode }) {
  const c = tone === "won" ? "text-won" : tone === "followup" ? "text-followup" : "text-accent";
  return (
    <Card>
      <h2 className={`mb-2.5 text-sm font-semibold ${c}`}>{title}</h2>
      {children}
    </Card>
  );
}

function BulletList({ items, marker, markerClass }: { items: string[]; marker: string; markerClass: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed">
          <span className={`shrink-0 ${markerClass}`}>{marker}</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
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
