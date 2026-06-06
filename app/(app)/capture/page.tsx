import { createClient } from "@/lib/supabase/server";
import { processTranscript } from "./actions";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import type { Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Capture({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("id, client_name, status")
    .order("updated_at", { ascending: false });
  const deals = (data ?? []) as Pick<Deal, "id" | "client_name" | "status">[];

  return (
    <main className="flex flex-col gap-4">
      <header className="pt-2">
        <h1 className="text-2xl font-semibold">Capture</h1>
        <p className="mt-1 text-sm text-muted">
          Paste a call or meeting transcript. The AI turns it into a deal,
          analysis, and draft follow-ups.
        </p>
      </header>

      <form action={processTranscript} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Transcript</span>
          <textarea
            name="transcript"
            rows={12}
            placeholder="Paste the full transcript here…"
            className="w-full resize-y px-3 py-2.5 text-sm leading-relaxed"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Attach to</span>
          <select name="deal_id" defaultValue="" className="w-full px-3 py-2.5">
            <option value="">Auto-detect (match by phone, or create new)</option>
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

        <SubmitButton pendingLabel="Analyzing…">Analyze transcript</SubmitButton>

        <p className="text-center text-xs text-muted">
          Analysis can take 10–20 seconds. Nothing is sent to email or calendar —
          that comes in later phases.
        </p>
      </form>
    </main>
  );
}
