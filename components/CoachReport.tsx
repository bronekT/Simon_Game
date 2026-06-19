"use client";

import { useState } from "react";
import type { CoachReport as Report } from "@/lib/ai/coach";

const TABS = [
  { key: "review", label: "Разбор", icon: "📈" },
  { key: "phrases", label: "Фразы", icon: "💬" },
  { key: "tricks", label: "Приёмы", icon: "🎩" },
  { key: "product", label: "Продукт", icon: "🚪" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// The AI coach report as an app-like, tabbed view (so it's calm, not a wall of
// text). Explanations are Russian; the lines to SAY to the client are English
// with a one-tap Copy.
export function CoachReport({ report }: { report: Report }) {
  const [tab, setTab] = useState<TabKey>("review");

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-1 rounded-full bg-white/[0.06] p-1 text-[11px]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full py-1.5 font-medium transition ${tab === t.key ? "bg-accent/20 text-accent" : "text-muted"}`}
          >
            <span className="mr-0.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "review" && (
        <div className="flex flex-col gap-3">
          {report.progress && (
            <Card title="📈 Твой прогресс" tone="accent">
              <p className="whitespace-pre-line text-sm leading-relaxed">{report.progress}</p>
            </Card>
          )}
          {report.strengths.length > 0 && (
            <Card title="💪 Что помогает закрывать" tone="won">
              <Bullets items={report.strengths} marker="✓" cls="text-won" />
            </Card>
          )}
          {report.improve.length > 0 && (
            <Card title="🎯 Над чем поработать" tone="followup">
              <Bullets items={report.improve} marker="→" cls="text-followup" />
            </Card>
          )}
        </div>
      )}

      {tab === "phrases" && (
        <Card title="💬 Что говорить клиенту" tone="accent">
          {report.phrases.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-2.5">
              {report.phrases.map((p, i) => (
                <div key={i} className="rounded-xl border border-hairline bg-white/[0.03] p-3">
                  {p.when && <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">{p.when}</p>}
                  <CopyLine text={p.say ?? ""} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "tricks" && (
        <Card title="🎩 Твои приёмы и техники" tone="accent">
          {report.tricks.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-3">
              {report.tricks.map((t, i) => (
                <div key={i} className="border-l-2 border-accent/40 pl-3">
                  {t.name && <p className="text-sm font-semibold text-accent">{t.name}</p>}
                  {t.how && <p className="mt-0.5 text-sm text-muted">{t.how}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "product" && (
        <Card title="🚪 Фишки по продукту (что сказать)" tone="won">
          {report.product_tips.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-2.5">
              {report.product_tips.map((t, i) => (
                <div key={i} className="rounded-xl border border-hairline bg-white/[0.03] p-3">
                  <CopyLine text={t} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// An English line to say to the client, with a one-tap copy.
function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — text is still visible */
    }
  }
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="text-sm italic leading-relaxed text-text">“{text}”</p>
      <button
        onClick={copy}
        className={`shrink-0 rounded-full border border-hairline px-2 py-0.5 text-[10px] ${copied ? "text-won" : "text-muted"}`}
      >
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}

function Card({ title, tone, children }: { title: string; tone: "won" | "followup" | "accent"; children: React.ReactNode }) {
  const c = tone === "won" ? "text-won" : tone === "followup" ? "text-followup" : "text-accent";
  return (
    <div className="rounded-card border border-hairline bg-white/[0.045] p-4">
      <h2 className={`mb-2.5 text-sm font-semibold ${c}`}>{title}</h2>
      {children}
    </div>
  );
}

function Bullets({ items, marker, cls }: { items: string[]; marker: string; cls: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed">
          <span className={`shrink-0 ${cls}`}>{marker}</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return <p className="text-sm text-muted">Появится после следующих разобранных встреч.</p>;
}
