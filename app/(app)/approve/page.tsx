import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { ApproveList, type QueueAction } from "@/components/ApproveList";
import { syncAction } from "./actions";
import { googleConfigured } from "@/lib/google/oauth";
import { titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  kind: QueueAction["kind"];
  payload: Record<string, string | null>;
  status: string;
  retries: number;
  client_name: string;
}

export default async function Approve() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("actions_queue")
    .select("id, kind, payload, status, retries, deals(client_name)")
    .in("status", ["proposed", "approved", "failed", "synced"])
    .order("created_at", { ascending: true });

  const rows: Row[] = (data ?? []).map((a) => ({
    id: a.id as string,
    kind: a.kind as QueueAction["kind"],
    payload: (a.payload ?? {}) as Record<string, string | null>,
    status: a.status as string,
    retries: (a.retries as number) ?? 0,
    client_name:
      (Array.isArray(a.deals)
        ? a.deals[0]?.client_name
        : (a.deals as { client_name?: string } | null)?.client_name) ?? "Unknown deal",
  }));

  const proposed = rows.filter((r) => r.status === "proposed");
  const processed = rows.filter((r) => r.status !== "proposed");

  const { data: g } = await supabase.from("google_accounts").select("email").maybeSingle();
  const googleConnected = Boolean(g);
  const hasGoogleActions = rows.some(
    (r) => r.kind === "email" || r.kind === "calendar_event",
  );

  return (
    <main className="flex flex-col gap-4">
      <header className="pt-2">
        <h1 className="text-2xl font-semibold">To approve</h1>
        <p className="mt-1 text-sm text-muted">
          AI proposals. Open one to edit, then approve. Nothing leaves the system
          until you tap ✓.
        </p>
      </header>

      {googleConfigured() && !googleConnected && hasGoogleActions && (
        <Card className="border-followup/40">
          <p className="text-sm text-followup">Google not connected.</p>
          <p className="mt-1 text-xs text-muted">
            Approving email/event still works, but it can only be pushed to Gmail
            / Calendar after you{" "}
            <Link href="/settings" className="text-accent">
              connect Google in Settings
            </Link>
            .
          </p>
        </Card>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Needs your decision</h2>
        {proposed.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">
              Nothing waiting. Analyze a transcript in <b>Capture</b> and proposed
              follow-ups show up here.
            </p>
          </Card>
        ) : (
          <ApproveList actions={proposed as QueueAction[]} />
        )}
      </section>

      {processed.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">Approved / sent</h2>
          {processed.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{r.client_name}</p>
                  <p className="truncate text-xs text-muted">
                    {titleCase(r.kind)} · {preview(r)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusTag status={r.status} retries={r.retries} />
                  {(r.status === "failed" ||
                    (r.status === "approved" && r.kind !== "sms")) && (
                    <form action={syncAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded-full border border-hairline px-3 py-1 text-xs text-text">
                        {r.status === "failed" ? "Retry" : "Push"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}

function preview(r: Row): string {
  if (r.kind === "calendar_event") return r.payload.title ?? "Event";
  return r.payload.subject || r.payload.body || "";
}

function StatusTag({ status, retries }: { status: string; retries: number }) {
  const map: Record<string, string> = {
    approved: "bg-task/15 text-task",
    synced: "bg-won/15 text-won",
    failed: "bg-risk/15 text-risk",
  };
  const label =
    status === "synced"
      ? "Synced ✓"
      : status === "failed"
        ? `Failed${retries ? ` ×${retries}` : ""}`
        : "Approved";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-white/10 text-muted"}`}>
      {label}
    </span>
  );
}
