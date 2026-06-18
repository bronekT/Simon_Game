import { approveAction, dismissAction } from "@/app/(app)/approve/actions";
import { dateTime } from "@/lib/format";
import { ActionButton } from "./ActionButton";
import type { QueueAction } from "./ApproveList";

// Hidden inputs carrying the action's current payload so a server-action submit
// approves/saves it as-is. (All inline — no modal, no new tab.)
function Payload({ a }: { a: QueueAction }) {
  const p = a.payload;
  const fields =
    a.kind === "email"
      ? { subject: p.subject ?? "", body: p.body ?? "", to: p.to ?? "" }
      : a.kind === "sms"
        ? { body: p.body ?? "", to: p.to ?? "" }
        : { title: p.title ?? "", start: p.start ?? "", location: p.location ?? "", notes: p.notes ?? "" };
  return (
    <>
      <input type="hidden" name="id" value={a.id} />
      <input type="hidden" name="kind" value={a.kind} />
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

// The meeting — pinned at the top with a one-tap Confirm (adds to Calendar).
export function MeetingConfirm({ action }: { action: QueueAction }) {
  const p = action.payload;
  return (
    <div className="rounded-card border border-accent/40 bg-accent/[0.07] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Meeting</p>
          <p className="mt-1 truncate text-sm font-medium">{p.title ?? "Visit"}</p>
          <p className="mt-0.5 text-xs text-muted">
            {dateTime(p.start)}
            {p.location ? ` · ${p.location}` : ""}
          </p>
        </div>
        <form className="shrink-0">
          <Payload a={action} />
          <ActionButton
            formAction={approveAction}
            pendingLabel="Adding…"
            doneLabel="Added ✓"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg"
          >
            Confirm
          </ActionButton>
        </form>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer list-none text-[11px] text-muted">Edit time / details</summary>
        <form className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="id" value={action.id} />
          <input type="hidden" name="kind" value="calendar_event" />
          <input name="title" defaultValue={p.title ?? ""} className="w-full px-3 py-2 text-sm" />
          <input name="start" type="datetime-local" defaultValue={toLocal(p.start)} className="w-full px-3 py-2 text-sm" />
          <input name="location" defaultValue={p.location ?? ""} placeholder="Location" className="w-full px-3 py-2 text-sm" />
          <textarea name="notes" defaultValue={p.notes ?? ""} rows={3} className="w-full px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button formAction={approveAction} className="flex-1 rounded-full bg-accent py-2 text-sm font-semibold text-bg">Save &amp; confirm</button>
            <button formAction={dismissAction} className="rounded-full border border-hairline px-4 py-2 text-sm text-risk">Dismiss</button>
          </div>
        </form>
      </details>
    </div>
  );
}

// Email + SMS follow-ups: colour-coded, collapsed, expand inline on tap.
export function FollowupActions({ actions }: { actions: QueueAction[] }) {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {actions.map((a) => (a.kind === "email" ? <EmailRow key={a.id} a={a} /> : <SmsRow key={a.id} a={a} />))}
    </div>
  );
}

function EmailRow({ a }: { a: QueueAction }) {
  const p = a.payload;
  return (
    <details className="rounded-card border border-task/40 bg-task/[0.06]">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3">
        <Tag color="task">Email</Tag>
        <span className="min-w-0 flex-1 truncate text-sm">{p.subject || "Follow-up email"}</span>
        <span className="text-muted">⌄</span>
      </summary>
      <form className="flex flex-col gap-2 px-3 pb-3">
        <input name="id" type="hidden" value={a.id} />
        <input name="kind" type="hidden" value="email" />
        <input name="to" defaultValue={p.to ?? ""} placeholder="To" className="w-full px-3 py-2 text-sm" />
        <input name="subject" defaultValue={p.subject ?? ""} placeholder="Subject" className="w-full px-3 py-2 text-sm" />
        <textarea name="body" defaultValue={p.body ?? ""} rows={6} className="w-full px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <button formAction={approveAction} className="flex-1 rounded-full bg-task/25 py-2 text-sm font-semibold text-task">Approve · create Gmail draft</button>
          <button formAction={dismissAction} className="rounded-full border border-hairline px-4 py-2 text-sm text-risk">✕</button>
        </div>
      </form>
    </details>
  );
}

function SmsRow({ a }: { a: QueueAction }) {
  const p = a.payload;
  const href = smsLink(p.to, p.body);
  return (
    <details className="rounded-card border border-won/40 bg-won/[0.06]">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3">
        <Tag color="won">SMS</Tag>
        <span className="min-w-0 flex-1 truncate text-sm">{(p.body ?? "Text message").slice(0, 60)}</span>
        <span className="text-muted">⌄</span>
      </summary>
      <form className="flex flex-col gap-2 px-3 pb-3">
        <input name="id" type="hidden" value={a.id} />
        <input name="kind" type="hidden" value="sms" />
        <input name="to" defaultValue={p.to ?? ""} placeholder="Phone (optional)" className="w-full px-3 py-2 text-sm" />
        <textarea name="body" defaultValue={p.body ?? ""} rows={5} className="w-full px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <a href={href} className="flex-1 rounded-full bg-won/25 py-2 text-center text-sm font-semibold text-won">📱 Open in Messages</a>
          <button formAction={approveAction} className="rounded-full border border-hairline px-4 py-2 text-sm text-won">Sent ✓</button>
          <button formAction={dismissAction} className="rounded-full border border-hairline px-4 py-2 text-sm text-risk">✕</button>
        </div>
      </form>
    </details>
  );
}

function Tag({ color, children }: { color: "task" | "won"; children: React.ReactNode }) {
  const c = color === "task" ? "bg-task/20 text-task" : "bg-won/20 text-won";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}

function smsLink(to: string | null, body: string | null): string {
  const num = (to ?? "").trim();
  const text = encodeURIComponent(body ?? "");
  return num ? `sms:${num}?&body=${text}` : `sms:?&body=${text}`;
}

function toLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Render in Toronto for the datetime-local input.
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d)) p[part.type] = part.value;
  const hh = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hh}:${p.minute}`;
}
