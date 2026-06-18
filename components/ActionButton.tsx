"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

// A submit button that gives clear VISUAL feedback on tap: it shows a pending
// label while the action runs, then flashes a "done" confirmation for a moment.
// (If the surrounding form disappears after the action — e.g. an item is
// approved out of a list — the disappearance itself is the confirmation.)
export function ActionButton({
  children,
  className = "",
  pendingLabel = "…",
  doneLabel = "✓",
  flashDone = true,
  formAction,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: React.ReactNode;
  doneLabel?: React.ReactNode;
  flashDone?: boolean;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  const [done, setDone] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    // When a submission finishes (pending went true → false), flash "done".
    if (wasPending.current && !pending && flashDone) {
      setDone(true);
      const t = setTimeout(() => setDone(false), 1400);
      wasPending.current = pending;
      return () => clearTimeout(t);
    }
    wasPending.current = pending;
  }, [pending, flashDone]);

  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      aria-busy={pending}
      className={`${className} transition active:scale-95 disabled:opacity-70 ${done ? "ring-2 ring-won/60" : ""}`}
    >
      {pending ? pendingLabel : done ? doneLabel : children}
    </button>
  );
}
