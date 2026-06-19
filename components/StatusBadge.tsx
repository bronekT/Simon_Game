import type { DealStatus } from "@/lib/types";
import { statusTone, titleCase } from "@/lib/format";

const TONE_CLASSES: Record<string, string> = {
  won: "bg-won/15 text-won ring-won/25",
  followup: "bg-followup/15 text-followup ring-followup/25",
  risk: "bg-risk/15 text-risk ring-risk/25",
  task: "bg-task/15 text-task ring-task/25",
  muted: "bg-white/10 text-muted ring-white/15",
};
const DOT: Record<string, string> = {
  won: "bg-won",
  followup: "bg-followup",
  risk: "bg-risk",
  task: "bg-task",
  muted: "bg-muted",
};

export function StatusBadge({ status }: { status: DealStatus }) {
  const tone = statusTone(status);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${TONE_CLASSES[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      {titleCase(status)}
    </span>
  );
}
