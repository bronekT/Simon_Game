"use client";

import { useState } from "react";
import { Card } from "./Card";
import { titleCase } from "@/lib/format";
import { approveAction, saveAction, dismissAction } from "@/app/(app)/approve/actions";

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

export function ApproveList({ actions }: { actions: QueueAction[] }) {
  const [open, setOpen] = useState<QueueAction | null>(null);

  return (
    <>
      <div className="flex flex-col gap-3">
        {actions.map((a) => (
          <button key={a.id} onClick={() => setOpen(a)} className="text-left">
            <Card className="active:bg-white/[0.05]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-task/15 px-2 py-0.5 text-xs font-medium text-task">
                    {KIND_LABEL[a.kind]}
                  </span>
                  {a.status === "failed" && (
                    <span className="rounded-full bg-risk/15 px-2 py-0.5 text-xs font-medium text-risk">
                      Failed · retry
                    </span>
                  )}
                </div>
                <span className="truncate text-sm text-muted">{a.client_name}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm">{preview(a)}</p>
            </Card>
          </button>
        ))}
      </div>

      {open && <ActionModal action={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function preview(a: QueueAction): string {
  if (a.kind === "calendar_event") {
    return `${a.payload.title ?? "Event"} — ${a.payload.start ?? ""}`;
  }
  return a.payload.subject ? `${a.payload.subject} — ${a.payload.body ?? ""}` : a.payload.body ?? "";
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

// Convert a stored ISO string into the value a <input type=datetime-local> wants.
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
