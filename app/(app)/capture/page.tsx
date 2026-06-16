import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { processTranscript, reprocessAppointment } from "./actions";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import { PendingOverlay } from "@/components/PendingOverlay";
import { dateTime } from "@/lib/format";
import type { Deal } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // allow background analysis to finish

export default async function Capture({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; logged?: string; processing?: string }>;
}) {
  const { error, logged, processing } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("id, client_name, status")
    .not("status", "in", "(won,lost,dead)")
    .order("updated_at", { ascending: false });
  const deals = (data ?? []) as Pick<Deal, "id" | "client_name" | "status">[];

  // Recent captures — so you can see incoming files (e.g. from the recorder) and,
  // critically, their PROCESSING STATUS: still analyzing, done, or failed.
  const { data: recentData } = await supabase
    .from("appointments")
    .select("id, source, record_type, created_at, deal_id, needs_review, deals(client_name)")
    .order("created_at", { ascending: false })
    .limit(8);
  const recent = (recentData ?? []).map((r) => {
    const recordType = (r.record_type as string) ?? null;
    const needsReview = Boolean(r.needs_review);
    // failed → AI errored; processing → saved but not analyzed yet; done → analyzed.
    const state: "failed" | "processing" | "done" = needsReview
      ? "failed"
      : recordType
        ? "done"
        : "processing";
    return {
      id: r.id as string,
      source: (r.source as string) ?? "manual",
      record_type: recordType,
      state,
      created_at: r.created_at as string,
      dealId: (r.deal_id as string) ?? null,
      client:
        (Array.isArray(r.deals) ? r.deals[0]?.client_name : (r.deals as { client_name?: string } | null)?.client_name) ?? null,
    };
  });
  const failedCount = recent.filter((r) => r.state === "failed").length;

  return (
    <main className="flex flex-col gap-4">
      <header className="pt-2">
        <h1 className="text-2xl font-semibold">Capture</h1>
        <p className="mt-1 text-sm text-muted">
          Paste a call or meeting transcript. The AI works out what it is — a
          booking call, a full appointment, a follow-up, or just a note — and
          handles each correctly.
        </p>
      </header>

      {processing && (
        <Card className="border-task/40">
          <p className="text-sm text-task">Analyzing in the background…</p>
          <p className="mt-1 text-xs text-muted">
            You can keep working. The deal &amp; proposed actions appear in{" "}
            <b>Deals</b> and <b>To approve</b> in ~15–20s — just refresh.
          </p>
        </Card>
      )}

      {logged === "note" && (
        <Card className="border-won/40">
          <p className="text-sm text-won">Logged as a note ✓</p>
          <p className="mt-1 text-xs text-muted">
            The AI decided this had no sales content, so it was just saved — no
            deal changes, scores, or follow-ups created.
          </p>
        </Card>
      )}

      <form action={processTranscript} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Transcript</span>
          <textarea
            name="transcript"
            rows={10}
            placeholder="Paste the full transcript here…"
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
          <span className="text-[11px] text-muted">
            A screenshot of a text/WhatsApp/email, or a transcript file — the AI reads it.
          </span>
        </label>

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

        {error && (
          <Card className="border-risk/40">
            <p className="text-sm text-risk">{error}</p>
            <p className="mt-1 text-xs text-muted">
              The transcript was saved and flagged for review — nothing was acted
              on. Fix and try again, or attach it to a deal manually.
            </p>
          </Card>
        )}

        <SubmitButton pendingLabel="Analyzing…">Analyze</SubmitButton>
        <PendingOverlay label="Analyzing your transcript…" />

        <p className="text-center text-xs text-muted">
          Takes ~10–20 seconds. Emails &amp; calendar events are proposed in
          <b> To approve</b> — nothing is sent until you tap ✓.
        </p>
      </form>

      {/* If any transcript failed to process, make it loud + offer a one-tap retry */}
      {failedCount > 0 && (
        <Card className="border-risk/40">
          <p className="text-sm text-risk">
            {failedCount} transcript{failedCount > 1 ? "s" : ""} couldn&apos;t be processed.
          </p>
          <p className="mt-1 text-xs text-muted">
            Usually a temporary AI hiccup. Tap <b>Reprocess</b> below to try again — your
            transcript is safe. If a Plaud/Zapier recording never appears here at all, your
            Plaud transcription credits may be used up (check the Plaud app).
          </p>
        </Card>
      )}

      {/* History with live status — confirms transcripts arrive AND finish */}
      {recent.length > 0 && (
        <section className="mt-2 flex flex-col gap-1.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Recent captures</h2>
          {recent.map((r) => {
            const badge =
              r.state === "failed"
                ? <span className="shrink-0 rounded-full bg-risk/15 px-2 py-0.5 text-[10px] font-semibold text-risk">Failed</span>
                : r.state === "processing"
                  ? <span className="shrink-0 rounded-full bg-task/15 px-2 py-0.5 text-[10px] font-semibold text-task">Processing…</span>
                  : <span className="shrink-0 rounded-full bg-won/15 px-2 py-0.5 text-[10px] font-semibold text-won">Done</span>;
            const row = (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-hairline bg-white/[0.03] px-3 py-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span>{r.source === "plaud" ? "📟" : "✍️"}</span>
                  <span className="truncate text-text">{r.client ?? (r.record_type ?? "Capture")}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {badge}
                  <span className="text-muted">{dateTime(r.created_at)}</span>
                </span>
              </div>
            );
            return (
              <div key={r.id} className="flex flex-col gap-1">
                {r.dealId && r.state === "done" ? (
                  <Link href={`/deals/${r.dealId}`}>{row}</Link>
                ) : (
                  row
                )}
                {r.state === "failed" && (
                  <form action={reprocessAppointment} className="self-end">
                    <input type="hidden" name="appointment_id" value={r.id} />
                    <button className="rounded-full bg-accent/15 px-3 py-1 text-[11px] font-semibold text-accent">
                      ↻ Reprocess
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
