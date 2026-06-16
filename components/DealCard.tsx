import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { DoorWantLine, EngagementChips } from "./DealMeta";
import { money, shortDate } from "@/lib/format";
import type { Deal } from "@/lib/types";

// One polished, tappable deal card — shared by Home and the Deals list.
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

// Just the visual (no link) — used inside the swipeable card on the Deals list.
export function DealCardBody({
  deal,
  showFollowup = false,
}: {
  deal: Deal;
  showFollowup?: boolean;
}) {
  return (
      <div className="rounded-card border border-hairline bg-white/[0.06] p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{deal.client_name}</p>
            {(deal.door_type || deal.door_count) ? (
              <p className="mt-0.5 truncate text-sm">
                <DoorWantLine type={deal.door_type} count={deal.door_count} />
              </p>
            ) : (
              <p className="mt-0.5 truncate text-sm text-muted">
                {deal.next_action ?? deal.address ?? "No details yet"}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusBadge status={deal.status} />
            <span className="inline-flex items-center gap-1 text-sm font-semibold">
              <MoneyIcon />
              {deal.quote_price != null ? money(deal.quote_price) : "—"}
            </span>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <EngagementChips deal={deal} />
          {showFollowup && deal.followup_at && (
            <span className="shrink-0 text-xs text-followup">⏰ {shortDate(deal.followup_at)}</span>
          )}
        </div>
      </div>
  );
}

function MoneyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3FD089" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.9 2.5 2-1.1 2-2.5 2A2.5 2.5 0 0 1 9.5 15M12 6v1.5M12 16.5V18" />
    </svg>
  );
}
