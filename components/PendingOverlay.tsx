"use client";

import { useFormStatus } from "react-dom";

// While a form's server action runs, show a clear blocking overlay so it's
// obvious the app is working (not frozen). Place INSIDE the <form>.
export function PendingOverlay({ label = "Analyzing…" }: { label?: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/85 backdrop-blur-sm">
      <div className="w-72 rounded-card border border-hairline bg-white/[0.06] p-5 text-center">
        <p className="text-base font-semibold">🧠 {label}</p>
        <p className="mt-1 text-xs text-muted">This takes ~15–20 seconds. Hang tight.</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full w-1/3 rounded-full bg-accent"
            style={{ animation: "barslide 0.9s ease-in-out infinite" }}
          />
        </div>
      </div>
    </div>
  );
}
