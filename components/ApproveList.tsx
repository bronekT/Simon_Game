"use client";

import { useRef, useState } from "react";
import { titleCase, dateTime, toLocalInput } from "@/lib/format";
import { approveAction, saveAction, dismissAction, dismissGroup } from "@/app/(app)/approve/actions";

export interface QueueAction {
  id: string;
  kind: "email" | "sms" | "calendar_event";
  payload: Record<string, string | null>;
  status: string;
  retries: number;
  client_name: string;
}

const KIND_LABEL: Record<QueueAction["kind"], string> = {
  email: "Email",
  sms: "SMS",
  calendar_event: "Calendar event",
};

// A flat list of approvable actions (used inside a single deal). Same one-tap
// ✓ / 📱 / ✕ controls and edit popup as the Approve screen.
export function ActionsInline({ actions }: { actions: QueueAction[] }) {
  const [open, setOpen] = useState<QueueAction | null>(null);
  if (actions.length === 0) return null;
  return (
    <>
      <div className="flex flex-col gap-2">
        {[...actions].sort(calendarFirst).map((a) => (
          <ActionRow key={a.id} a={a} onEdit={() => setOpen(a)} />
        ))}
      </div>
      {open && <ActionModal action={open} onClose={() => setOpen(null)} />}
    </>
  );
}

// Meetings (calendar) float to the top — that's the thing to confirm first.
function calendarFirst(a: QueueAction, b: QueueAction): number {
  return (a.kind === "calendar_event" ? 0 : 1) - (b.kind === "calendar_event" ? 0 : 1);
}

export interface LeadGroup {
  dealId: string;
  clientName: string;
  actions: QueueAction[];
}

// Grouped by lead, newest first; tap a lead to reveal its proposed actions.
export function ApproveList({ groups }: { groups: LeadGroup[] }) {
  const [open, setOpen] = useState<QueueAction | null>(null);

  return (
    <>
      <p className="-mb-1 text-center text-[11px] text-muted">
        Swipe a lead ← to <span className="text-risk">dismiss the whole block</span>
      </p>
      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <SwipeGroup key={g.dealId} group={g} onEdit={(a) => setOpen(a)} />
        ))}
      </div>

      {open && <ActionModal action={open} onClose={() => setOpen(null)} />}
    </>
  );
}

// A lead's block: tap to expand, or swipe LEFT to dismiss all of its proposals.
function SwipeGroup({ group, onEdit }: { group: LeadGroup; onEdit: (a: QueueAction) => void }) {
  const [dx, setDx] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const horiz = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const THRESHOLD = 120;

  function onStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    horiz.current = false;
    setSwiping(true);
  }
  function onMove(e: React.TouchEvent) {
    if (!swiping) return;
    const x = e.touches[0].clientX - startX.current;
    const y = e.touches[0].clientY - startY.current;
    if (Math.abs(x) > Math.abs(y) && Math.abs(x) > 8) horiz.current = true;
    if (horiz.current && x < 0) setDx(x); // only drag left
  }
  function onEnd() {
    setSwiping(false);
    if (dx < -THRESHOLD) {
      formRef.current?.requestSubmit();
      return; // leave it slid out; the list refreshes
    }
    setDx(0);
  }

  const ids = group.actions.map((a) => a.id).join(",");

  return (
    <div className="relative overflow-hidden rounded-card">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-end rounded-card bg-risk/15 pr-5 text-sm font-bold text-risk">
        {dx < -24 ? "Dismiss ✕" : ""}
      </div>
      <details
        className="relative rounded-card border border-hairline bg-white/[0.05]"
        style={{ transform: `translateX(${dx}px)`, transition: swiping ? "none" : "transform 0.2s" }}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between p-3">
          <span className="truncate font-medium">{group.clientName}</span>
          <span className="ml-2 shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
            {group.actions.length} to review
          </span>
        </summary>
        <div className="flex flex-col gap-2 border-t border-hairline p-2">
          {group.actions.map((a) => (
            <ActionRow key={a.id} a={a} onEdit={() => onEdit(a)} />
          ))}
        </div>
      </details>
      <form ref={formRef} action={dismissGroup} className="hidden">
        <input type="hidden" name="ids" value={ids} />
      </form>
    </div>
  );
}

function ActionRow({ a, onEdit }: { a: QueueAction; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] p-2">
      <button onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-2 text-left active:opacity-70">
        <span className="shrink-0 rounded-full bg-task/15 px-2 py-0.5 text-xs font-medium text-task">
          {KIND_LABEL[a.kind]}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{shortTitle(a)}</span>
        <span className="shrink-0 text-[11px] text-accent">open</span>
      </button>
      <form className="flex shrink-0 flex-col gap-2">
        <PayloadInputs action={a} />
        {a.kind === "sms" ? (
          <a
            href={smsLink(a.payload.to, a.payload.body)}
            aria-label="Open Messages"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-task/20 text-base text-task active:scale-90"
          >
            📱
          </a>
        ) : (
          <button
            type="submit"
            formAction={approveAction}
            aria-label="Approve"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-won/20 text-lg text-won active:scale-90"
          >
            ✓
          </button>
        )}
        <button
          type="submit"
          formAction={a.kind === "sms" ? approveAction : dismissAction}
          aria-label={a.kind === "sms" ? "Mark done" : "Dismiss"}
          className={`flex h-9 w-9 items-center justify-center rounded-full text-lg active:scale-90 ${
            a.kind === "sms" ? "bg-won/20 text-won" : "bg-risk/15 text-risk"
          }`}
        >
          {a.kind === "sms" ? "✓" : "✕"}
        </button>
      </form>
    </div>
  );
}

// Hidden inputs carrying the current payload, so a one-tap ✓ approves as-is.
function PayloadInputs({ action }: { action: QueueAction }) {
  const p = action.payload;
  const fields =
    action.kind === "email"
      ? { subject: p.subject ?? "", body: p.body ?? "", to: p.to ?? "" }
      : action.kind === "sms"
        ? { body: p.body ?? "", to: p.to ?? "" }
        : { title: p.title ?? "", start: p.start ?? "", location: p.location ?? "", notes: p.notes ?? "" };
  return (
    <>
      <input type="hidden" name="id" value={action.id} />
      <input type="hidden" name="kind" value={action.kind} />
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

// Compact, collapsed label (the full text only opens in the modal on tap).
function shortTitle(a: QueueAction): string {
  if (a.kind === "calendar_event") return `Meeting · ${dateTime(a.payload.start)}`;
  if (a.kind === "email") return a.payload.subject || "Email follow-up";
  return "Text message follow-up";
}

function ActionModal({
  action,
  onClose,
}: {
  action: QueueAction;
  onClose: () => void;
}) {
  const p = action.payload;
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = action.kind === "email" && p.subject ? `${p.subject}\n\n${p.body ?? ""}` : p.body ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — text is still visible */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-card border border-hairline bg-bg p-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {KIND_LABEL[action.kind]} · {action.client_name}
          </h2>
          <button onClick={onClose} className="text-muted">
            ✕
          </button>
        </div>

        <form className="flex flex-col gap-3">
          <input type="hidden" name="id" value={action.id} />
          <input type="hidden" name="kind" value={action.kind} />

          {action.kind === "email" && (
            <>
              <Field label="To">
                <input name="to" defaultValue={p.to ?? ""} placeholder="email@example.com" className="w-full px-3 py-2.5" />
              </Field>
              <Field label="Subject">
                <input name="subject" defaultValue={p.subject ?? ""} className="w-full px-3 py-2.5" />
              </Field>
              <Field label="Body">
                <textarea name="body" defaultValue={p.body ?? ""} rows={8} className="w-full px-3 py-2.5 text-sm" />
              </Field>
            </>
          )}

          {action.kind === "sms" && (
            <>
              <Field label="To">
                <input name="to" defaultValue={p.to ?? ""} placeholder="phone" className="w-full px-3 py-2.5" />
              </Field>
              <Field label="Message">
                <textarea name="body" defaultValue={p.body ?? ""} rows={6} className="w-full px-3 py-2.5 text-sm" />
              </Field>
              <div className="flex gap-2">
                <button type="button" onClick={copy} className="flex-1 rounded-full border border-hairline py-2 text-sm">
                  {copied ? "Copied ✓" : "Copy"}
                </button>
                <a
                  href={smsLink(p.to, p.body)}
                  className="flex-1 rounded-full border border-hairline py-2 text-center text-sm text-task"
                >
                  Open in Messages
                </a>
              </div>
            </>
          )}

          {action.kind === "calendar_event" && (
            <>
              <Field label="Title">
                <input name="title" defaultValue={p.title ?? ""} className="w-full px-3 py-2.5" />
              </Field>
              <Field label="Start">
                <input
                  name="start"
                  type="datetime-local"
                  defaultValue={toLocalInput(p.start)}
                  className="w-full px-3 py-2.5"
                />
              </Field>
              <Field label="Location">
                <input name="location" defaultValue={p.location ?? ""} className="w-full px-3 py-2.5" />
              </Field>
              <Field label="Notes">
                <textarea name="notes" defaultValue={p.notes ?? ""} rows={4} className="w-full px-3 py-2.5 text-sm" />
              </Field>
            </>
          )}

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              formAction={approveAction}
              className="flex-1 rounded-full bg-accent py-3 font-medium text-bg"
            >
              ✓ Approve
            </button>
            <button
              type="submit"
              formAction={saveAction}
              className="rounded-full border border-hairline px-4 py-3 text-sm text-text"
            >
              Save
            </button>
            <button
              type="submit"
              formAction={dismissAction}
              className="rounded-full border border-hairline px-4 py-3 text-sm text-risk"
            >
              Dismiss
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}

function smsLink(to: string | null, body: string | null): string {
  const num = (to ?? "").trim();
  const text = encodeURIComponent(body ?? "");
  // iOS/Android both accept sms:?&body=... ; include number when present.
  return num ? `sms:${num}?&body=${text}` : `sms:?&body=${text}`;
}

