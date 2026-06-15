import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { ApproveList, type QueueAction } from "@/components/ApproveList";

export const dynamic = "force-dynamic";

export default async function Approve() {
  const supabase = await createClient();

  // Proposed = needs your decision. Failed = a Google push to retry (Phase 3).
  const { data } = await supabase
    .from("actions_queue")
    .select("id, kind, payload, status, retries, deals(client_name)")
    .in("status", ["proposed", "failed"])
    .order("created_at", { ascending: true });

  const actions = (data ?? []).map((a) => ({
    id: a.id as string,
    kind: a.kind as QueueAction["kind"],
    payload: (a.payload ?? {}) as Record<string, string | null>,
    status: a.status as string,
    retries: (a.retries as number) ?? 0,
    // Supabase returns the joined row as an object (or array depending on rel).
    client_name:
      (Array.isArray(a.deals) ? a.deals[0]?.client_name : (a.deals as { client_name?: string } | null)?.client_name) ??
      "Unknown deal",
  })) as QueueAction[];

  return (
    <main className="flex flex-col gap-4">
      <header className="pt-2">
        <h1 className="text-2xl font-semibold">To approve</h1>
        <p className="mt-1 text-sm text-muted">
          AI proposals. Open one to edit, then approve. Nothing is sent until you
          tap ✓ — and Google delivery turns on in Phase 3.
        </p>
      </header>

      {actions.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Nothing waiting. Analyze a transcript in <b>Capture</b> and proposed
            follow-ups will show up here.
          </p>
        </Card>
      ) : (
        <ApproveList actions={actions} />
      )}
    </main>
  );
}
