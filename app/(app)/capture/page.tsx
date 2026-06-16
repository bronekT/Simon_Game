import { createClient } from "@/lib/supabase/server";
import { processTranscript } from "./actions";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
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

        <p className="text-center text-xs text-muted">
          Takes ~10–20 seconds. Emails &amp; calendar events are proposed in
          <b> To approve</b> — nothing is sent until you tap ✓.
        </p>
      </form>
    </main>
  );
}
