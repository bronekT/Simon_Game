import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { processTranscript } from "./actions";
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

  // Recent captures — so you can see incoming files (e.g. from the recorder).
  const { data: recentData } = await supabase
    .from("appointments")
    .select("id, source, record_type, created_at, deal_id, deals(client_name)")
    .order("created_at", { ascending: false })
    .limit(8);
  const recent = (recentData ?? []).map((r) => ({
    id: r.id as string,
    source: (r.source as string) ?? "manual",
    record_type: (r.record_type as string) ?? null,
    created_at: r.created_at as string,
    dealId: (r.deal_id as string) ?? null,
    client:
      (Array.isArray(r.deals) ? r.deals[0]?.client_name : (r.deals as { client_name?: string } | null)?.client_name) ?? null,
  }));

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

      {/* Subtle history — confirms transcripts (incl. from the recorder) arrive */}
      {recent.length > 0 && (
        <section className="mt-2 flex flex-col gap-1.5 opacity-80">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Recent captures</h2>
          {recent.map((r) => {
            const inner = (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-hairline bg-white/[0.03] px-3 py-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span>{r.source === "plaud" ? "📟" : "✍️"}</span>
                  <span className="truncate text-text">{r.client ?? (r.record_type ?? "Capture")}</span>
                </span>
                <span className="shrink-0 text-muted">{dateTime(r.created_at)}</span>
              </div>
            );
            return r.dealId ? (
              <Link key={r.id} href={`/deals/${r.dealId}`}>{inner}</Link>
            ) : (
              <div key={r.id}>{inner}</div>
            );
          })}
        </section>
      )}
    </main>
  );
}
