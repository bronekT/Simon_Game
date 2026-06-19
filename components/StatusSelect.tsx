import { setStatus } from "@/app/(app)/deals/[id]/quick-actions";
import { DEAL_STATUSES, type DealStatus } from "@/lib/types";
import { titleCase, statusTone } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

// Change a deal's status reliably: tap the badge to open, tap a status to set
// it (each is a real form submit of a server action — no flaky JS).
export function StatusSelect({ id, status }: { id: string; status: DealStatus }) {
  return (
    <details className="relative z-50">
      <summary className="cursor-pointer list-none">
        <StatusBadge status={status} />
      </summary>
      <div className="glass-strong absolute right-0 z-50 mt-2 w-48 rounded-card border border-hairline p-2 shadow-2xl">
        <div className="flex flex-wrap gap-1.5">
          {DEAL_STATUSES.map((s) => (
            <form action={setStatus} key={s}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value={s} />
              <button
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  s === status ? toneBg(s) : "border border-hairline text-muted"
                }`}
              >
                {titleCase(s)}
              </button>
            </form>
          ))}
        </div>
      </div>
    </details>
  );
}

function toneBg(s: DealStatus): string {
  const tone = statusTone(s);
  const map: Record<string, string> = {
    won: "bg-won/20 text-won",
    followup: "bg-followup/20 text-followup",
    risk: "bg-risk/20 text-risk",
    task: "bg-task/20 text-task",
    muted: "bg-white/15 text-text",
  };
  return map[tone] ?? "bg-white/15 text-text";
}
