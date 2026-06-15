import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeReactivation } from "@/lib/ai/write";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OPEN = ["new", "booked", "met", "quoted", "negotiation"];

// Daily automations (SPEC.md Phase 5):
//  - no follow-up / activity in 3 days on an open deal  -> at_risk
//  - dead lead for 30 days                              -> reactivation draft
// Secret-protected; runs without a session (service-role, RLS bypassed).
export async function GET(request: Request) {
  return handle(request);
}
export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const provided =
    new URL(request.url).searchParams.get("secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const threeDaysAgo = new Date(now - 3 * 86400_000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 86400_000).toISOString();

  // --- At-risk: flag quiet open deals, clear ones that are active or closed ---
  await admin.from("deals").update({ at_risk: true })
    .in("status", OPEN).lt("updated_at", threeDaysAgo).eq("at_risk", false);
  await admin.from("deals").update({ at_risk: false })
    .eq("at_risk", true).gte("updated_at", threeDaysAgo);
  await admin.from("deals").update({ at_risk: false })
    .eq("at_risk", true).in("status", ["won", "lost", "dead"]);

  // --- Reactivation drafts for long-dead leads (one per deal per month) ------
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;

  const { data: dead } = await admin
    .from("deals")
    .select("id, user_id, client_name, service_type, main_objection, email")
    .eq("status", "dead")
    .lt("updated_at", thirtyDaysAgo)
    .limit(20);

  let reactivated = 0;
  for (const deal of dead ?? []) {
    const idk = `react-${deal.id}-${ym}`;
    const { data: exists } = await admin
      .from("actions_queue")
      .select("id")
      .eq("idempotency_key", idk)
      .maybeSingle();
    if (exists) continue;

    const { data: s } = await admin
      .from("settings")
      .select("company_name, email_signature")
      .eq("user_id", deal.user_id)
      .maybeSingle();

    const draft = await writeReactivation(
      {
        client_name: deal.client_name as string | null,
        service_type: deal.service_type as string | null,
        main_objection: deal.main_objection as string | null,
      },
      {
        company_name: s?.company_name ?? null,
        showroom_address: null,
        email_signature: s?.email_signature ?? null,
      },
    );

    await admin.from("drafts").insert({
      user_id: deal.user_id,
      deal_id: deal.id,
      type: "reactivation",
      channel: "email",
      subject: draft.subject,
      body: draft.body,
      status: "draft",
    });
    await admin.from("actions_queue").insert({
      user_id: deal.user_id,
      deal_id: deal.id,
      kind: "email",
      payload: { subject: draft.subject, body: draft.body, to: deal.email ?? null, draft_type: "reactivation" },
      status: "proposed",
      idempotency_key: idk,
    });
    reactivated++;
  }

  return NextResponse.json({ ok: true, reactivated });
}
