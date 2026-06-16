"use client";

// Root error boundary. If anything in the root layout or an un-grouped route
// throws on the client, this renders instead of a dead white screen. It must
// include <html>/<body> because it REPLACES the root layout.
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // A failed JS chunk (common on flaky mobile networks, or right after a new
    // deploy) → reload once to fetch the fresh bundle.
    if (isChunkError(error) && !sessionStorage.getItem("chunk-reloaded")) {
      sessionStorage.setItem("chunk-reloaded", "1");
      window.location.reload();
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "#0A0A0C", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 600 }}>Something glitched</p>
          <p style={{ fontSize: 14, opacity: 0.7, maxWidth: 320 }}>
            The screen failed to load. This is almost always temporary — reload and you&apos;re back.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 8, borderRadius: 999, background: "#C8A24B", color: "#0A0A0C", padding: "12px 28px", fontWeight: 600, border: "none" }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}

function isChunkError(error: Error): boolean {
  const s = `${error?.name} ${error?.message}`;
  return /ChunkLoadError|Loading chunk|Importing a module script failed|dynamically imported module|Failed to fetch/i.test(s);
}
