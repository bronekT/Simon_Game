import { doorWant, engagement, type DealStatus, type DoorType } from "@/lib/types";

// A small door glyph used wherever we describe what the client wants.
export function DoorIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M4 21h16" />
      <circle cx="15" cy="12.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// "3× Patio doors" with an icon — what the client is looking for.
export function DoorWantLine({
  type,
  count,
  className = "",
}: {
  type: DoorType | null;
  count: number | null;
  className?: string;
}) {
  const text = doorWant(type, count);
  if (!text) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-muted ${className}`}>
      <span className="text-accent"><DoorIcon /></span>
      {text}
    </span>
  );
}

// Minimal, uniform engagement signals: a colored dot + label. Kept deliberately
// quiet (status is already shown by the status badge) so the card reads cleanly.
export function EngagementChips({
  deal,
  className = "",
}: {
  deal: { status: DealStatus; quote_price: number | null; followup_sent_at: string | null };
  className?: string;
}) {
  const e = engagement(deal);
  const chips: { label: string; dot: string }[] = [];
  if (e.quoted) chips.push({ label: "Quoted", dot: "bg-followup" });
  chips.push(
    e.followupSent
      ? { label: "Followed up", dot: "bg-won" }
      : { label: "No follow-up", dot: "bg-muted" },
  );

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      {chips.map((c) => (
        <span key={c.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
          {c.label}
        </span>
      ))}
    </div>
  );
}
