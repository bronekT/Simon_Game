"use client";

import { useFormStatus } from "react-dom";

// Submit button that shows a pending state while the server action runs, so the
// long AI call gives clear feedback (Section 3: never fail/stall silently).
export function SubmitButton({
  children,
  pendingLabel = "Working…",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-accent py-3 font-medium text-bg disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
