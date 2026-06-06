"use client";

// Persistent quick-capture bar (SPEC.md Section 10). In Phase 0 this is a
// visual placeholder — it will gain real note/command capture in a later phase.
export function VoiceBar() {
  return (
    <div className="fixed inset-x-0 bottom-[58px] z-10 px-3 pb-2">
      <div className="mx-auto flex max-w-md items-center gap-2 rounded-full border border-hairline bg-white/[0.04] px-4 py-2.5 backdrop-blur">
        <MicIcon />
        <span className="text-sm text-muted">Quick note or command…</span>
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E9A23B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
