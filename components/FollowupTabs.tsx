"use client";

import { useRef, useState } from "react";
import { approveAction, dismissAction } from "@/app/(app)/approve/actions";
import type { QueueAction } from "./ApproveList";
import type { FollowupTemplate } from "@/lib/templates";

// Human label for an AI draft's purpose (payload.draft_type).
const TYPE_LABEL: Record<string, string> = {
  soft: "Soft check-in",
  urgency: "Urgency",
  price: "Price",
  competitor: "Competitor",
  financing: "Financing",
  decision_maker: "Decision maker",
  showroom_invite: "Showroom invite",
  last_chance: "Last chance",
  reactivation: "Reactivation",
  confirmation: "Confirmation",
};

// Follow-ups as an Email ⇄ SMS toggle (also swipeable). Each side lists the
// AI-written drafts (labelled by purpose, editable + approvable) and a menu of
// ready-to-send templates by purpose (name already filled in).
export function FollowupTabs({
  actions,
  emailTemplates,
  smsTemplates,
  to,
}: {
  actions: QueueAction[];
  emailTemplates: FollowupTemplate[];
  smsTemplates: FollowupTemplate[];
  to: { email: string | null; phone: string | null };
}) {
  const [tab, setTab] = useState<"email" | "sms">("email");
  const startX = useRef(0);
  const startY = useRef(0);

  function onStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }
  function onEnd(e: React.TouchEvent) {
    const x = e.changedTouches[0].clientX - startX.current;
    const y = e.changedTouches[0].clientY - startY.current;
    if (Math.abs(x) > 55 && Math.abs(x) > Math.abs(y)) {
      setTab(x < 0 ? "sms" : "email"); // swipe left → SMS, right → Email
    }
  }

  const emailActions = actions.filter((a) => a.kind === "email");
  const smsActions = actions.filter((a) => a.kind === "sms");

  return (
    <div className="flex flex-col gap-3">
      {/* Semi-transparent segmented toggle with a sliding indicator */}
      <div className="relative grid grid-cols-2 rounded-full bg-white/[0.06] p-1 text-sm">
        <span
          className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-accent/20 transition-transform duration-200"
          style={{ transform: tab === "sms" ? "translateX(100%)" : "translateX(0)" }}
        />
        <button
          onClick={() => setTab("email")}
          className={`relative z-10 rounded-full py-1.5 font-medium transition-colors ${tab === "email" ? "text-accent" : "text-muted"}`}
        >
          ✉️ Email
        </button>
        <button
          onClick={() => setTab("sms")}
          className={`relative z-10 rounded-full py-1.5 font-medium transition-colors ${tab === "sms" ? "text-won" : "text-muted"}`}
        >
          💬 SMS
        </button>
      </div>

      <div onTouchStart={onStart} onTouchEnd={onEnd} className="flex flex-col gap-2">
        {tab === "email" ? (
          <>
            {emailActions.map((a) => (
              <DraftRow key={a.id} a={a} channel="email" />
            ))}
            <TemplateList channel="email" templates={emailTemplates} to={to} />
          </>
        ) : (
          <>
            {smsActions.map((a) => (
              <DraftRow key={a.id} a={a} channel="sms" />
            ))}
            <TemplateList channel="sms" templates={smsTemplates} to={to} />
          </>
        )}
      </div>
    </div>
  );
}

// An AI-written draft: collapsed to its purpose; expands to edit + approve.
function DraftRow({ a, channel }: { a: QueueAction; channel: "email" | "sms" }) {
  const p = a.payload;
  const label = TYPE_LABEL[(p.draft_type as string) ?? ""] ?? (channel === "email" ? "Email" : "Text");
  // Literal class strings (Tailwind can't see interpolated names).
  const box = channel === "email" ? "border-task/40 bg-task/[0.06]" : "border-won/40 bg-won/[0.06]";
  const badge = channel === "email" ? "bg-task/20 text-task" : "bg-won/20 text-won";
  return (
    <details className={`rounded-card border ${box}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge}`}>{label}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted">
          {channel === "email" ? p.subject || "Email follow-up" : (p.body ?? "").slice(0, 50)}
        </span>
        <span className="text-[11px] text-accent">AI ⌄</span>
      </summary>
      <form className="flex flex-col gap-2 px-3 pb-3">
        <input name="id" type="hidden" value={a.id} />
        <input name="kind" type="hidden" value={channel} />
        <input name="to" defaultValue={p.to ?? ""} placeholder={channel === "email" ? "To (email)" : "Phone (optional)"} className="w-full px-3 py-2 text-sm" />
        {channel === "email" && (
          <input name="subject" defaultValue={p.subject ?? ""} placeholder="Subject" className="w-full px-3 py-2 text-sm" />
        )}
        <textarea name="body" defaultValue={p.body ?? ""} rows={channel === "email" ? 6 : 4} className="w-full px-3 py-2 text-sm" />
        <div className="flex gap-2">
          {channel === "sms" ? (
            <a href={smsLink(p.to, p.body)} className="flex-1 rounded-full bg-won/25 py-2 text-center text-sm font-semibold text-won">📱 Open in Messages</a>
          ) : (
            <button formAction={approveAction} className="flex-1 rounded-full bg-task/25 py-2 text-sm font-semibold text-task">Approve · Gmail draft</button>
          )}
          <button formAction={channel === "sms" ? approveAction : dismissAction} className={`rounded-full border border-hairline px-4 py-2 text-sm ${channel === "sms" ? "text-won" : "text-risk"}`}>
            {channel === "sms" ? "Sent ✓" : "✕"}
          </button>
        </div>
      </form>
    </details>
  );
}

// Ready-to-send templates by purpose. Collapsed to the purpose; expand for text.
function TemplateList({
  channel,
  templates,
  to,
}: {
  channel: "email" | "sms";
  templates: FollowupTemplate[];
  to: { email: string | null; phone: string | null };
}) {
  return (
    <div className="mt-1 flex flex-col gap-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Ready templates — tap to open</p>
      {templates.map((t) => (
        <TemplateRow key={t.key} t={t} channel={channel} to={to} />
      ))}
    </div>
  );
}

function TemplateRow({
  t,
  channel,
  to,
}: {
  t: FollowupTemplate;
  channel: "email" | "sms";
  to: { email: string | null; phone: string | null };
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const text = channel === "email" && t.subject ? `${t.subject}\n\n${t.body}` : t.body;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — text is still visible to copy manually */
    }
  }
  return (
    <details className="rounded-card border border-hairline bg-white/[0.03]">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3">
        <span className="min-w-0 flex-1 text-sm font-medium">{t.label}</span>
        <span className="text-[11px] text-muted">⌄</span>
      </summary>
      <div className="flex flex-col gap-2 px-3 pb-3">
        {channel === "email" && t.subject && (
          <p className="text-xs font-semibold text-text">{t.subject}</p>
        )}
        <p className="whitespace-pre-line text-sm text-muted">{t.body}</p>
        <div className="flex gap-2">
          {channel === "sms" && (
            <a href={smsLink(to.phone, t.body)} className="flex-1 rounded-full bg-won/25 py-2 text-center text-sm font-semibold text-won">📱 Open in Messages</a>
          )}
          <button type="button" onClick={copy} className={`rounded-full border border-hairline py-2 text-sm ${channel === "sms" ? "px-4" : "flex-1"} text-text`}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>
    </details>
  );
}

function smsLink(toNum: string | null, body: string | null): string {
  const num = (toNum ?? "").trim();
  const text = encodeURIComponent(body ?? "");
  return num ? `sms:${num}?&body=${text}` : `sms:?&body=${text}`;
}
