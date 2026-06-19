import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { DoorWantLine, EngagementChips } from "./DealMeta";
import { money, shortDate, statusTone } from "@/lib/format";
import type { Deal } from "@/lib/types";

// One clean, tappable deal card — shared by Home and the Deals list.
export function DealCard({ deal, showFollowup = false }: { deal: Deal; showFollowup?: boolean }) {
  return (
    <Link href={`/deals/${deal.id}`} className="block">
      <DealCardBody deal={deal} showFollowup={showFollowup} />
    </Link>
  );
}

// Status accent (left stripe), as literal classes.
const STRIPE: Record<string, string> = {
  won: "bg-won",
  followup: "bg-followup",
  risk: "bg-risk",
  task: "bg-task",
  muted: "bg-white/25",
};

// Visual only (no link) — used inside the swipeable card on the Deals list.
export function DealCardBody({ deal, showFollowup = false }: { deal: Deal; showFollowup?: boolean }) {
  const tone = statusTone(deal.status);
  const atRisk = (deal as Deal & { at_risk?: boolean }).at_risk;
  const prob = deal.probability;

  return (
    <div className="relative overflow-hidden rounded-card border border-hairline bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-4 pl-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-150">
      {/* status accent stripe */}
      <span className={`absolute inset-y-0 left-0 w-1 ${STRIPE[tone]}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-[15px] font-semibold">
            {atRisk && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-risk shadow-[0_0_8px_rgba(240,86,93,0.8)]" />}
            <span className="truncate">{deal.client_name}</span>
          </p>
          <p className="mt-1 truncate text-sm">
            {deal.door_type || deal.door_count ? (
              <DoorWantLine type={deal.door_type} count={deal.door_count} />
            ) : (
              <span className="text-muted">{deal.next_action ?? deal.address ?? "No details yet"}</span>
            )}
          </p>
        </div>
        <StatusBadge status={deal.status} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        {deal.quote_price != null ? (
          <p className="text-lg font-bold gradient-text">{money(deal.quote_price)}</p>
        ) : (
          <span className="text-xs text-muted">No quote yet</span>
        )}
        {prob != null && <CloseMeterLabel prob={prob} />}
      </div>

      {prob != null && <CloseMeter prob={prob} />}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <EngagementChips deal={deal} />
        {showFollowup && deal.followup_at && (
          <span className="shrink-0 rounded-full bg-followup/15 px-2 py-0.5 text-[11px] font-medium text-followup">
            due {shortDate(deal.followup_at)}
          </span>
        )}
      </div>
    </div>
  );
}

function probBucket(p: number): { cls: string; bar: string; label: string } {
  if (p >= 70) return { cls: "text-won", bar: "bg-won", label: "likely" };
  if (p >= 40) return { cls: "text-followup", bar: "bg-followup", label: "warming" };
  return { cls: "text-risk", bar: "bg-risk", label: "cold" };
}

function CloseMeterLabel({ prob }: { prob: number }) {
  const b = probBucket(prob);
  return <span className={`shrink-0 text-xs font-semibold tabular-nums ${b.cls}`}>{prob}% · {b.label}</span>;
}

// A thin "close-meter" — visual likelihood of closing, color-coded.
function CloseMeter({ prob }: { prob: number }) {
  const b = probBucket(prob);
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${b.bar} transition-all duration-700`} style={{ width: `${Math.max(4, Math.min(100, prob))}%` }} />
    </div>
  );
}
