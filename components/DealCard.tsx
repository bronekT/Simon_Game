import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { DoorWantLine, EngagementChips } from "./DealMeta";
import { money, shortDate } from "@/lib/format";
import type { Deal } from "@/lib/types";

// One clean, tappable deal card — shared by Home and the Deals list.
export function DealCard({
  deal,
  showFollowup = false,
}: {
  deal: Deal;
  showFollowup?: boolean;
}) {
  return (
    <Link href={`/deals/${deal.id}`} className="block">
      <DealCardBody deal={deal} showFollowup={showFollowup} />
    </Link>
  );
}

// Visual only (no link) — used inside the swipeable card on the Deals list.
export function DealCardBody({
  deal,
  showFollowup = false,
}: {
  deal: Deal;
  showFollowup?: boolean;
}) {
  return (
    <div className="rounded-card border border-hairline bg-white/[0.045] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{deal.client_name}</p>
        <StatusBadge status={deal.status} />
      </div>

      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-muted">
          {deal.door_type || deal.door_count ? (
            <DoorWantLine type={deal.door_type} count={deal.door_count} />
          ) : (
            deal.next_action ?? deal.address ?? "No details yet"
          )}
        </p>
        <p className="shrink-0 text-sm font-semibold tabular-nums">
          {deal.quote_price != null ? money(deal.quote_price) : ""}
        </p>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <EngagementChips deal={deal} />
        {showFollowup && deal.followup_at && (
          <span className="shrink-0 text-[11px] text-followup">due {shortDate(deal.followup_at)}</span>
        )}
      </div>
    </div>
  );
}
