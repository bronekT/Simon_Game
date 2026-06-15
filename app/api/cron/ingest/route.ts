import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authedClientForUser } from "@/lib/google/oauth";
import { readLabelTranscripts, markProcessed } from "@/lib/google/gmail";
import { runPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Scheduled ingestion (SPEC.md Phase 4). Reads new transcript emails from a
// Gmail label and runs each through the pipeline into the approval queue.
// Triggered by Supabase Scheduled Function / Vercel Cron — protected by a shared
// secret. Runs without a logged-in user, so it uses the service-role client and
// scopes everything by the connected account's user_id.
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

  // Single-user app: find the connected Google account.
  const { data: account } = await admin
    .from("google_accounts")
    .select("user_id")
    .limit(1)
    .maybeSingle();
  if (!account?.user_id) {
    return NextResponse.json({ ok: true, processed: 0, note: "No connected Google account." });
  }
  const userId = account.user_id as string;

  const auth = await authedClientForUser(admin);
  if (!auth) {
    return NextResponse.json({ ok: true, processed: 0, note: "No Google tokens." });
  }

  const label = process.env.CLOSER_GMAIL_LABEL ?? "CLOSER";
  const { items, labelId } = await readLabelTranscripts(auth, label);

  let processed = 0;
  const errors: string[] = [];
  for (const item of items) {
    const result = await runPipeline(admin, item.text, null, userId, "plaud");
    if (result.ok) {
      processed++;
      if (labelId) {
        try {
          await markProcessed(auth, item.messageId, labelId);
        } catch {
          /* leave label so we retry next run */
        }
      }
    } else {
      errors.push(result.error);
      // Leave the message labeled; the appointment is flagged needs_review.
    }
  }

  return NextResponse.json({ ok: true, found: items.length, processed, errors });
}
