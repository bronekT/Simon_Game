"use client";

import { useState } from "react";
import { titleCase } from "@/lib/format";

interface DraftCardProps {
  type: string | null;
  channel: string | null;
  subject: string | null;
  body: string;
}

// A generated follow-up the user can read and copy. Collapsible to stay compact.
export function DraftCard({ type, channel, subject, body }: DraftCardProps) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    const text = subject ? `${subject}\n\n${body}` : body;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the text is still visible */
    }
  }

  return (
    <details className="group rounded-card border border-hairline bg-white/[0.02]">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3">
        <span className="rounded-full bg-task/15 px-2 py-0.5 text-xs font-medium text-task">
          {channel === "sms" ? "SMS" : "Email"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {subject || titleCase(type)}
        </span>
        <span className="text-muted transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="px-3 pb-3">
        {subject && <p className="mb-1 text-sm font-medium">{subject}</p>}
        <p className="whitespace-pre-wrap text-sm text-muted">{body}</p>
        <button
          onClick={copy}
          className="mt-3 rounded-full border border-hairline px-3 py-1 text-xs text-text active:bg-white/10"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </details>
  );
}
