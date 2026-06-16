import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestTranscript, analyzeAppointment } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Inbound transcript webhook (Plaud / Zapier / Make / Shortcuts).
// POST /api/inbound?token=...  with either:
//   - JSON  { "transcript": "..." }  (or { "text": "..." })
//   - or a raw text/plain body
// Authenticated by the user's personal inbound token (no login needed).
//
// IMPORTANT: we DECOUPLE ingest from analysis. The transcript is saved and we
// reply 200 immediately (well under a second), then run the heavy two-step AI
// pipeline in the BACKGROUND via after(). This is what fixes the Zapier
// FUNCTION_INVOCATION_TIMEOUT — Zapier no longer waits for the AI.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 401 });

  const admin = createAdminClient();
  const { data: s } = await admin
    .from("settings")
    .select("user_id")
    .eq("inbound_token", token)
    .maybeSingle();
  if (!s?.user_id) return NextResponse.json({ error: "invalid token" }, { status: 401 });
  const userId = s.user_id as string;

  // Accept JSON or raw text.
  let transcript = "";
  const ctype = request.headers.get("content-type") ?? "";
  if (ctype.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    transcript = String(body.transcript ?? body.text ?? body.content ?? "").trim();
  } else {
    transcript = (await request.text()).trim();
  }

  if (transcript.length < 20) {
    return NextResponse.json({ error: "transcript too short" }, { status: 400 });
  }

  // Save first (fast) so nothing is ever lost, even if analysis later fails.
  const appointmentId = await ingestTranscript(admin, userId, transcript, null, "plaud");
  if (!appointmentId) {
    return NextResponse.json({ ok: false, error: "could not save transcript" }, { status: 500 });
  }

  // Heavy AI work runs AFTER the response is sent (up to maxDuration).
  after(async () => {
    try {
      await analyzeAppointment(createAdminClient(), userId, appointmentId);
    } catch (e) {
      // Flag for review so it surfaces in the app and can be reprocessed.
      try {
        await createAdminClient()
          .from("appointments")
          .update({ needs_review: true })
          .eq("id", appointmentId);
      } catch {
        /* best effort */
      }
      console.error("inbound analyze failed", e);
    }
  });

  // Tell the caller we accepted it. Zapier sees a clean success right away.
  return NextResponse.json({ ok: true, queued: true, appointmentId }, { status: 202 });
}
