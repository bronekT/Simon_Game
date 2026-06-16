"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestTranscript, analyzeAppointment } from "@/lib/pipeline";
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

// DECOUPLED: save the transcript fast, then run the heavy two-step AI pipeline in
// the BACKGROUND (after the response). This is what stops the page from timing
// out on Vercel — the same fix as the inbound webhook. The new deal / proposed
// actions appear within ~15–20s; pull-to-refresh (or the banner) reveals them.
export async function processTranscript(form: FormData) {
  const attachRaw = String(form.get("deal_id") ?? "").trim();
  const attachDealId = attachRaw === "" ? null : attachRaw;
  const backTo = String(form.get("back_to") ?? "/capture");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const userId = user.id;

  let transcript = "";
  try {
    transcript = await resolveTranscript(form);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong reading the file.";
    redirect(`${backTo}?error=${encodeURIComponent(msg)}`);
  }
  if (transcript.length < 20) {
    redirect(`${backTo}?error=${encodeURIComponent("Add a transcript, paste text, or attach a screenshot/file.")}`);
  }

  // Save first so the transcript is never lost.
  const appointmentId = await ingestTranscript(supabase, userId, transcript, attachDealId, "manual");
  if (!appointmentId) {
    redirect(`${backTo}?error=${encodeURIComponent("Could not save the transcript. Try again.")}`);
  }

  // Analyze in the background (uses the service-role client, which stays valid
  // after the response is sent).
  after(async () => {
    try {
      await analyzeAppointment(createAdminClient(), userId, appointmentId!);
    } catch {
      try {
        await createAdminClient()
          .from("appointments")
          .update({ needs_review: true })
          .eq("id", appointmentId!);
      } catch {
        /* best effort */
      }
    }
  });

  revalidatePath("/");
  revalidatePath("/deals");
  revalidatePath("/approve");

  // If attached to a known deal, land there (pull-to-refresh shows the update).
  if (attachDealId) {
    revalidatePath(`/deals/${attachDealId}`);
    redirect(`/deals/${attachDealId}?analyzing=1`);
  }
  redirect(`/capture?processing=1`);
}

// Re-run analysis for a transcript that failed or got stuck (e.g. an AI hiccup,
// or a transcript that arrived but never finished processing). Same background
// pattern — the saved transcript is reused, no re-paste needed.
export async function reprocessAppointment(form: FormData) {
  const appointmentId = String(form.get("appointment_id") ?? "").trim();
  if (!appointmentId) redirect("/capture");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const userId = user.id;

  // Clear the failed flag so it shows as "processing" again immediately.
  await supabase.from("appointments").update({ needs_review: false }).eq("id", appointmentId);

  after(async () => {
    try {
      await analyzeAppointment(createAdminClient(), userId, appointmentId);
    } catch {
      try {
        await createAdminClient()
          .from("appointments")
          .update({ needs_review: true })
          .eq("id", appointmentId);
      } catch {
        /* best effort */
      }
    }
  });

  revalidatePath("/capture");
  redirect("/capture?processing=1");
}
