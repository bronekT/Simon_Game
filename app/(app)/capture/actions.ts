"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runPipeline, analyzeAppointment } from "@/lib/pipeline";
import { imageToTranscript, isSupportedImage } from "@/lib/ai/vision";

// Read the text to analyze from the textarea or an uploaded file (a .txt
// transcript, or a screenshot we read with vision).
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

// SYNCHRONOUS by design. The whole pipeline runs in ~10–20s, well under the
// route's maxDuration (60s), so we run it inline: the button shows "Analyzing…",
// then you land on the finished deal WITH its analysis. (Background processing
// via after() proved unreliable on this host — jobs got stuck "Processing" and
// never completed, so leads never appeared.)
export async function processTranscript(form: FormData) {
  const attachRaw = String(form.get("deal_id") ?? "").trim();
  const attachDealId = attachRaw === "" ? null : attachRaw;
  const backTo = String(form.get("back_to") ?? "/capture");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let result;
  let errorMsg = "";
  try {
    const transcript = await resolveTranscript(form);
    if (transcript.length < 20) {
      errorMsg = "Add a transcript, paste text, or attach a screenshot/file.";
    } else {
      result = await runPipeline(supabase, transcript, attachDealId, user.id, "manual");
    }
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Something went wrong reading the file.";
  }

  if (errorMsg) redirect(`${backTo}?error=${encodeURIComponent(errorMsg)}`);
  if (!result!.ok) redirect(`${backTo}?error=${encodeURIComponent(result!.error)}`);

  revalidatePath("/");
  revalidatePath("/deals");
  revalidatePath("/approve");

  // A pure note (no sales content) creates no deal — say so plainly.
  if (!result!.dealId) redirect(`/capture?logged=note`);

  revalidatePath(`/deals/${result!.dealId}`);
  redirect(`/deals/${result!.dealId}?analyzed=1`);
}

// Re-run analysis for a transcript that failed or got stuck. Synchronous too —
// reuses the saved transcript, so no re-paste, and lands on the finished deal.
export async function reprocessAppointment(form: FormData) {
  const appointmentId = String(form.get("appointment_id") ?? "").trim();
  if (!appointmentId) redirect("/capture");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let result;
  try {
    result = await analyzeAppointment(supabase, user.id, appointmentId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not reprocess.";
    redirect(`/capture?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/capture");
  revalidatePath("/deals");
  revalidatePath("/approve");

  if (result!.ok && result!.dealId) {
    redirect(`/deals/${result!.dealId}?analyzed=1`);
  }
  redirect("/capture");
}
