import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPipeline } from "@/lib/pipeline";
import { produceFollowups } from "@/lib/followups";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Inbound transcript webhook (Plaud / Zapier / Make / Shortcuts).
// POST /api/inbound?token=...  with either:
//   - JSON  { "transcript": "..." }  (or { "text": "..." })
//   - or a raw text/plain body
// Authenticated by the user's personal inbound token (no login needed).
//
// SYNCHRONOUS: the pipeline runs in ~10–20s, comfortably inside maxDuration (60s),
// so we run it inline and return the result. (Background processing via after()
// proved unreliable here — jobs got stuck and never finished.)
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

  const result = await runPipeline(admin, transcript, null, userId, "plaud");
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, appointmentId: result.appointmentId },
      { status: 200 },
    );
  }

  // No client here to fire step 2, so generate follow-ups + coaching inline for
  // appointments (extraction was a single fast call, leaving room within 60s).
  if (result.recordType === "appointment" && result.dealId) {
    try {
      await produceFollowups(admin, userId, result.dealId);
    } catch {
      /* best effort — the deal is already complete */
    }
  }

  return NextResponse.json({
    ok: true,
    dealId: result.dealId,
    recordType: result.recordType,
  });
}
