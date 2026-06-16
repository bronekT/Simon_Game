import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import { generate } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Coaching({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal } = await supabase.from("deals").select("client_name").eq("id", id).maybeSingle();
  if (!deal) notFound();

  const { data: appt } = await supabase
    .from("appointments")
    .select("analysis")
    .eq("deal_id", id)
    .not("record_type", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const deep = (appt?.analysis as { deep_coaching?: string } | null)?.deep_coaching ?? null;
  const hasAppt = Boolean(appt);

  return (
    <main className="flex flex-col gap-4">
      <header className="pt-2">
        <Link href={`/deals/${id}`} className="text-sm text-accent">← {deal.client_name}</Link>
        <h1 className="mt-2 text-2xl font-semibold">🎓 Detailed coaching</h1>
      </header>

      {!hasAppt ? (
        <Card>
          <p className="text-sm text-muted">
            No analyzed appointment yet. Capture an appointment transcript first.
          </p>
        </Card>
      ) : (
        <>
          {deep && (
            <Card>
              <p className="whitespace-pre-line text-sm leading-relaxed">{deep}</p>
            </Card>
          )}

          <form action={generate}>
            <input type="hidden" name="deal_id" value={id} />
            <SubmitButton pendingLabel="Generating… (~20s)">
              {deep ? "Regenerate breakdown" : "Generate detailed breakdown"}
            </SubmitButton>
          </form>
          {!deep && (
            <p className="text-center text-xs text-muted">
              A full review: what you did well, what to fix, exact phrasing, and the next move to close.
            </p>
          )}
        </>
      )}
    </main>
  );
}
