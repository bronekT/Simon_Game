import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

const SCORE_FIELDS = [
  ["score_rapport", "Rapport"],
  ["score_discovery", "Discovery"],
  ["score_pain", "Pain"],
  ["score_product", "Product"],
  ["score_objection", "Objection"],
  ["score_closing", "Closing"],
  ["score_followup", "Follow-up"],
] as const;

export default async function Coach() {
  const supabase = await createClient();

  const { data: apptData } = await supabase
    .from("appointments")
    .select(
      "talk_ratio, score_rapport, score_discovery, score_pain, score_product, score_objection, score_closing, score_followup",
    )
    .not("record_type", "is", null);
  const appts = apptData ?? [];

  const { data: outcomeData } = await supabase
    .from("outcomes")
    .select("result, reason");
  const outcomes = outcomeData ?? [];

  const avg = (key: string) => {
    const vals = appts.map((a) => (a as Record<string, number | null>)[key]).filter((v): v is number => typeof v === "number");
    return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
  };

  const talk = avg("talk_ratio");
  const won = outcomes.filter((o) => o.result === "won").length;
  const lost = outcomes.filter((o) => o.result === "lost").length;
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null;

  const reasonCounts = new Map<string, number>();
  outcomes
    .filter((o) => o.result === "lost" && o.reason)
    .forEach((o) => reasonCounts.set(o.reason as string, (reasonCounts.get(o.reason as string) ?? 0) + 1));
  const lossReasons = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]);

  // Lowest average skill = the thing to work on next.
  const skillAverages = SCORE_FIELDS.map(([k, label]) => ({ label, value: avg(k) }))
    .filter((s) => s.value != null) as { label: string; value: number }[];
  const weakest = [...skillAverages].sort((a, b) => a.value - b.value)[0];

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold">Coach report</h1>
        <Link href="/" className="text-sm text-accent">
          Done
        </Link>
      </header>

      {appts.length === 0 && outcomes.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No analyzed calls yet. Capture a few transcripts and your coaching
            trends will build up here.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Calls analyzed" value={String(appts.length)} />
            <Stat label="Win rate" value={winRate != null ? `${winRate}%` : "—"} />
            <Stat label="Avg talk %" value={talk != null ? `${talk}%` : "—"} />
          </div>

          {skillAverages.length > 0 && (
            <Card>
              <p className="mb-3 text-xs font-semibold text-muted">Average skill scores (/10)</p>
              <div className="flex flex-col gap-2.5">
                {SCORE_FIELDS.map(([k, label]) => {
                  const v = avg(k);
                  return (
                    <div key={k} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-xs text-muted">{label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${((v ?? 0) / 10) * 100}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-xs">{v ?? "—"}</span>
                    </div>
                  );
                })}
              </div>
              {weakest && (
                <p className="mt-3 border-t border-hairline pt-3 text-sm text-muted">
                  Focus area: <span className="text-accent">{weakest.label}</span> is your
                  lowest average — work on that next.
                </p>
              )}
            </Card>
          )}

          <Card>
            <p className="mb-2 text-xs font-semibold text-muted">Outcomes</p>
            <div className="flex gap-4 text-sm">
              <span className="text-won">Won {won}</span>
              <span className="text-risk">Lost {lost}</span>
            </div>
            {lossReasons.length > 0 && (
              <div className="mt-3 border-t border-hairline pt-3">
                <p className="mb-1 text-xs text-muted">Why deals were lost</p>
                {lossReasons.map(([reason, count]) => (
                  <div key={reason} className="flex justify-between text-sm">
                    <span className="text-muted">{titleCase(reason)}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </Card>
  );
}
