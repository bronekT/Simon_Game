import type { DealStatus } from "@/lib/types";
import { statusTone, titleCase } from "@/lib/format";

const TONE_CLASSES: Record<string, string> = {
  won: "bg-won/15 text-won",
  followup: "bg-followup/15 text-followup",
  risk: "bg-risk/15 text-risk",
  task: "bg-task/15 text-task",
  muted: "bg-white/10 text-muted",
};

export function StatusBadge({ status }: { status: DealStatus }) {
  const tone = statusTone(status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {titleCase(status)}
    </span>
  );
}
