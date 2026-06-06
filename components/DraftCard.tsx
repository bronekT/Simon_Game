"use client";

import { useState } from "react";
import { Card } from "./Card";
import { titleCase } from "@/lib/format";

interface DraftCardProps {
  type: string | null;
  channel: string | null;
  subject: string | null;
  body: string;
}

// A generated follow-up the user can read and copy (Phase 1). Sending/approval
// happens later — for now "copy" is the action (Section 1: human in the loop).
export function DraftCard({ type, channel, subject, body }: DraftCardProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = subject ? `${subject}\n\n${body}` : body;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked — ignore; the text is still visible to copy.
    }
  }

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-task/15 px-2 py-0.5 text-xs font-medium text-task">
            {channel === "sms" ? "SMS" : "Email"}
          </span>
          <span className="text-xs text-muted">{titleCase(type)}</span>
        </div>
        <button
          onClick={copy}
          className="rounded-full border border-hairline px-3 py-1 text-xs text-text active:bg-white/10"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      {subject && <p className="mb-1 text-sm font-medium">{subject}</p>}
      <p className="whitespace-pre-wrap text-sm text-muted">{body}</p>
    </Card>
  );
}
