import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPipeline } from "@/lib/pipeline";
import { imageToTranscript, isSupportedImage } from "@/lib/ai/vision";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Client-driven capture. The browser posts here and shows a non-blocking top
// progress bar; this route runs the FULL pipeline with the SERVICE-ROLE client
// (the exact path that works reliably — no RLS surprises) and returns the deal.
export async function POST(request: Request) {
  // Authenticate the user from their session cookies.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const attachRaw = String(form.get("deal_id") ?? "").trim();
  const attachDealId = attachRaw === "" ? null : attachRaw;

  let transcript = "";
  try {
    transcript = await resolveTranscript(form);
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) });
  }
  if (transcript.length < 20) {
    return NextResponse.json({ ok: false, error: "Add a transcript, paste text, or attach a screenshot/file." });
  }

  // Service-role client, scoped to this authenticated user.
  const admin = createAdminClient();
  const result = await runPipeline(admin, transcript, attachDealId, user.id, "manual");
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error });

  return NextResponse.json({
    ok: true,
    dealId: result.dealId,
    recordType: result.recordType,
    logged: !result.dealId, // a pure note → no deal
  });
}

async function resolveTranscript(form: FormData): Promise<string> {
  const typed = String(form.get("transcript") ?? "").trim();
  const file = form.get("file");
  if (file && file instanceof File && file.size > 0) {
    const mediaType = file.type || "application/octet-stream";
    if (isSupportedImage(mediaType)) {
      const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      const fromImage = await imageToTranscript(base64, mediaType);
      return typed ? `${typed}\n\n${fromImage}` : fromImage;
    }
    const text = (await file.text()).trim();
    if (text) return typed ? `${typed}\n\n${text}` : text;
  }
  return typed;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong reading the file.";
}
