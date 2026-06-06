import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { money, titleCase, dateTime, shortDate } from "@/lib/format";
import type { Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DealDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const deal = data as Deal;

  return (
    <main className="flex flex-col gap-5">
      <header className="pt-2">
        <Link href="/deals" className="text-sm text-accent">
          ← Deals
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{deal.client_name}</h1>
          <StatusBadge status={deal.status} />
        </div>
        {deal.next_action && (
          <p className="mt-1 text-sm text-muted">{deal.next_action}</p>
        )}
      </header>

      {/* Key numbers */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Quote" value={money(deal.quote_price)} />
        <Stat
          label="Probability"
          value={deal.probability != null ? `${deal.probability}%` : "—"}
        />
        <Stat label="Follow up" value={shortDate(deal.followup_at)} />
      </div>

      {/* Details */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-muted">Details</h2>
        <dl className="flex flex-col divide-y divide-hairline">
          <Row label="Service" value={titleCase(deal.service_type)} />
          <Row label="Lead source" value={titleCase(deal.lead_source)} />
          <Row label="Location" value={titleCase(deal.location_type)} />
          <Row label="Phone" value={deal.phone ?? "—"} />
          <Row label="Email" value={deal.email ?? "—"} />
          <Row label="Address" value={deal.address ?? "—"} />
          <Row label="Decision maker" value={deal.decision_maker ?? "—"} />
          <Row label="Competitor" value={deal.competitor ?? "—"} />
          <Row label="Main objection" value={deal.main_objection ?? "—"} />
          <Row label="Created" value={dateTime(deal.created_at)} />
        </dl>
      </Card>

      {/* AI analysis placeholder — arrives in Phase 1 */}
      <Card>
        <h2 className="mb-1 text-sm font-semibold text-muted">AI Analysis</h2>
        <p className="text-sm text-muted">
          Paste a call transcript to generate a summary, scores, talk-ratio, and
          draft follow-ups. (Coming in Phase 1.)
        </p>
      </Card>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm">{value}</dd>
    </div>
  );
}
