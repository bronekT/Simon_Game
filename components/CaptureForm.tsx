"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface DealOption {
  id: string;
  client_name: string;
  status: string;
}

type Phase = "idle" | "analyzing" | "success" | "error";

// Capture / update form that processes in the BACKGROUND. On submit it posts the
// transcript to /api/capture and shows a thin, NON-blocking progress bar pinned
// to the top of the screen (amber while working → green when a deal is added).
// You can keep using the app while it runs; on success it jumps to the deal.
export function CaptureForm({
  deals = [],
  dealId,
  compact = false,
}: {
  deals?: DealOption[];
  dealId?: string; // when updating a specific deal (deal page)
  compact?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (phase === "analyzing") return;
    const form = e.currentTarget;
    const data = new FormData(form);
    if (dealId) data.set("deal_id", dealId);

    setMessage("");
    setPhase("analyzing");
    try {
      const res = await fetch("/api/capture", { method: "POST", body: data });
      const json = await res.json().catch(() => ({ ok: false, error: "Server error." }));
      if (!json.ok) {
        setPhase("error");
        setMessage(json.error || "Could not analyze. Try again.");
        return;
      }
      setPhase("success");
      form.reset();

      // Step 2 (background): generate polished follow-ups + coaching. Fired and
      // forgotten — the deal already exists; this fills in the AI follow-ups a
      // few seconds later. keepalive lets it survive navigation.
      if (json.dealId) {
        fetch("/api/capture/followups", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dealId: json.dealId }),
          keepalive: true,
        }).catch(() => {});
      }

      // Refresh data everywhere, then reveal the result.
      router.refresh();
      window.setTimeout(() => {
        if (dealId) {
          setPhase("idle"); // stay on this deal; refreshed analysis shows
          setMessage("Updated ✓");
        } else if (json.dealId) {
          router.push(`/deals/${json.dealId}?analyzed=1`);
        } else {
          setPhase("idle");
          setMessage("Logged as a note ✓ (no sales content)");
        }
      }, 700);
    } catch {
      setPhase("error");
      setMessage("Network hiccup — your text is safe, tap Analyze again.");
    }
  }

  return (
    <>
      <ProgressBar phase={phase} />

      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{dealId ? "New transcript / note" : "Transcript"}</span>
          <textarea
            name="transcript"
            rows={dealId ? 3 : 10}
            placeholder={dealId ? "Paste a new transcript / note (optional if attaching a file)…" : "Paste the full transcript here…"}
            className="w-full resize-y px-3 py-2.5 text-sm leading-relaxed"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">…or attach a screenshot / file</span>
          <input
            type="file"
            name="file"
            accept="image/*,.txt,.md,text/plain"
            className="w-full rounded-xl border border-hairline bg-white/[0.04] px-3 py-2.5 text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-1 file:text-bg"
          />
          {!compact && (
            <span className="text-[11px] text-muted">
              A screenshot of a text/WhatsApp/email, or a transcript file — the AI reads it.
            </span>
          )}
        </label>

        {!dealId && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Attach to</span>
            <select name="deal_id" defaultValue="" className="w-full px-3 py-2.5">
              <option value="">✨ New deal from this transcript (auto-detect)</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.client_name} · {d.status}
                </option>
              ))}
            </select>
          </label>
        )}

        {phase === "error" && message && (
          <div className="rounded-card border border-risk/40 bg-risk/[0.06] p-3">
            <p className="text-sm text-risk">{message}</p>
            <p className="mt-1 text-xs text-muted">Your text is still here — fix and tap Analyze again.</p>
          </div>
        )}
        {phase === "idle" && message && (
          <div className="rounded-card border border-won/40 bg-won/[0.06] p-3">
            <p className="text-sm text-won">{message}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={phase === "analyzing"}
          className="rounded-full bg-accent py-3 text-center font-semibold text-bg active:scale-[0.99] disabled:opacity-70"
        >
          {phase === "analyzing" ? "Analyzing…" : dealId ? "Update from this" : "Analyze"}
        </button>

        <p className="text-center text-xs text-muted">
          Runs in the background — you can keep using the app. The deal &amp; proposed
          actions appear automatically when it&apos;s done.
        </p>
      </form>
    </>
  );
}

// Thin, non-blocking bar pinned to the very top of the screen.
function ProgressBar({ phase }: { phase: Phase }) {
  if (phase === "idle") return null;
  const tone =
    phase === "success" ? "bg-won" : phase === "error" ? "bg-risk" : "bg-accent";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-1.5">
      <div className="relative h-full w-full overflow-hidden bg-white/5">
        {phase === "analyzing" ? (
          <div
            className={`absolute inset-y-0 left-0 w-1/3 ${tone}`}
            style={{ animation: "barslide 0.9s ease-in-out infinite" }}
          />
        ) : (
          <div className={`h-full w-full ${tone} transition-all duration-500`} />
        )}
      </div>
    </div>
  );
}
