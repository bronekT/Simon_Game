"use client";

// Route-level error boundary for every signed-in screen. A crash on ONE screen
// now shows a friendly retry here (with the nav still usable) instead of taking
// down the whole app. Auto-reloads once on a failed JS chunk.
import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isChunkError(error) && !sessionStorage.getItem("chunk-reloaded")) {
      sessionStorage.setItem("chunk-reloaded", "1");
      window.location.reload();
    } else {
      // Clear the guard once a non-chunk render succeeds-then-fails cycle ends.
      sessionStorage.removeItem("chunk-reloaded");
    }
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold">This screen hit a snag</p>
      <p className="max-w-xs text-sm text-muted">
        It&apos;s usually temporary. Try again, or go Home — your data is safe.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => reset()}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-bg active:scale-95"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-hairline px-5 py-2.5 text-sm text-text active:scale-95"
        >
          Home
        </Link>
      </div>
      {error?.digest && <p className="mt-2 text-[10px] text-muted">ref: {error.digest}</p>}
    </main>
  );
}

function isChunkError(error: Error): boolean {
  const s = `${error?.name} ${error?.message}`;
  return /ChunkLoadError|Loading chunk|Importing a module script failed|dynamically imported module|Failed to fetch/i.test(s);
}
