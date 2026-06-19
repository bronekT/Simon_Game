import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { DoorWantLine, EngagementChips } from "./DealMeta";
import { Ring } from "./Ring";
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
    <div className="relative overflow-hidden rounded-card border border-hairline bg-gradient-to-b from-white/[0.075] to-white/[0.02] p-4 pl-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-150">
      {/* status accent stripe + soft glow */}
      <span className={`absolute inset-y-0 left-0 w-1 ${STRIPE[tone]}`} />

      <div className="flex items-stretch justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            {atRisk && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-risk shadow-[0_0_8px_rgba(240,86,93,0.8)]" />}
            <p className="truncate text-[15px] font-semibold">{deal.client_name}</p>
            <span className="ml-auto"><StatusBadge status={deal.status} /></span>
          </div>

          <p className="mt-1 truncate text-sm">
            {deal.door_type || deal.door_count ? (
              <DoorWantLine type={deal.door_type} count={deal.door_count} />
            ) : (
              <span className="text-muted">{deal.next_action ?? deal.address ?? "No details yet"}</span>
            )}
          </p>

          <div className="mt-auto flex items-center gap-2 pt-2">
            {deal.quote_price != null ? (
              <p className="text-xl font-bold gradient-text">{money(deal.quote_price)}</p>
            ) : (
              <span className="text-xs text-muted">No quote yet</span>
            )}
            {showFollowup && deal.followup_at && (
              <span className="ml-auto shrink-0 rounded-full bg-followup/15 px-2 py-0.5 text-[11px] font-medium text-followup">
                due {shortDate(deal.followup_at)}
              </span>
            )}
          </div>
        </div>

        {/* close-meter ring */}
        {prob != null && (
          <div className="flex shrink-0 flex-col items-center justify-center">
            <Ring pct={prob} size={52} stroke={6}>
              <span className={`text-xs font-bold ${probTone(prob)}`}>{prob}</span>
            </Ring>
            <span className={`mt-1 text-[10px] font-medium ${probTone(prob)}`}>{probLabel(prob)}</span>
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-hairline pt-2.5">
        <EngagementChips deal={deal} />
      </div>
    </div>
  );
}

function probTone(p: number): string {
  return p >= 70 ? "text-won" : p >= 40 ? "text-followup" : "text-risk";
}
function probLabel(p: number): string {
  return p >= 70 ? "likely" : p >= 40 ? "warming" : "cold";
}
