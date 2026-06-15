import { doorWant, engagement, type DealStatus, type DoorType } from "@/lib/types";

// A small door glyph used wherever we describe what the client wants.
export function DoorIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M15 12h.01" />
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
    <span className={`inline-flex items-center gap-1 text-accent ${className}`}>
      <DoorIcon />
      {text}
    </span>
  );
}

// Engagement signals: has it been booked, met, quoted, followed up?
export function EngagementChips({
  deal,
  className = "",
}: {
  deal: { status: DealStatus; quote_price: number | null; followup_sent_at: string | null };
  className?: string;
}) {
  const e = engagement(deal);
  const chips: { label: string; tone: string; icon: React.ReactNode }[] = [];

  if (e.booked) chips.push({ label: "Booked", tone: "text-task", icon: <CalIcon /> });
  if (e.met) chips.push({ label: "Met", tone: "text-task", icon: <CheckIcon /> });
  if (e.quoted) chips.push({ label: "Quoted", tone: "text-followup", icon: <TagIcon /> });
  chips.push(
    e.followupSent
      ? { label: "Followed up", tone: "text-won", icon: <SendIcon /> }
      : { label: "No follow-up", tone: "text-muted", icon: <SendIcon /> },
  );

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {chips.map((c) => (
        <span
          key={c.label}
          className={`inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] ${c.tone}`}
        >
          {c.icon}
          {c.label}
        </span>
      ))}
    </div>
  );
}

function CalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
  );
}
function TagIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 11.5 3H21v9.5L12.5 21z" /><path d="M16.5 7.5h.01" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
  );
}
