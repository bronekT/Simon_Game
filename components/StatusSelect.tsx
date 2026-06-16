"use client";

import { setStatus } from "@/app/(app)/deals/[id]/quick-actions";
import { DEAL_STATUSES, type DealStatus } from "@/lib/types";
import { titleCase, statusTone } from "@/lib/format";

const TONE: Record<string, string> = {
  won: "text-won", followup: "text-followup", risk: "text-risk", task: "text-task", muted: "text-text",
};

// Change a deal's status inline — pick from the dropdown, it saves immediately.
export function StatusSelect({ id, status }: { id: string; status: DealStatus }) {
  return (
    <form action={setStatus}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`rounded-full border border-hairline bg-white/[0.06] px-3 py-1 text-xs font-medium ${TONE[statusTone(status)]}`}
      >
        {DEAL_STATUSES.map((s) => (
          <option key={s} value={s}>{titleCase(s)}</option>
        ))}
      </select>
    </form>
  );
}
