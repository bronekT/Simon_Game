"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runPipeline, type PipelineResult } from "@/lib/pipeline";
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

// Synchronous so the flow is obvious: the button shows "Analyzing…", then you
// land on the deal. Used by Capture and the per-deal "update from file".
export async function processTranscript(form: FormData) {
  const attachRaw = String(form.get("deal_id") ?? "").trim();
  const attachDealId = attachRaw === "" ? null : attachRaw;
  const backTo = String(form.get("back_to") ?? "/capture");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let result: PipelineResult | null = null;
  let errorMsg = "";
  try {
    const transcript = await resolveTranscript(form);
    if (transcript.length < 20) {
      errorMsg = "Add a transcript, paste text, or attach a screenshot/file.";
    } else {
      result = await runPipeline(supabase, transcript, attachDealId, user.id);
    }
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Something went wrong reading the file.";
  }

  if (errorMsg) redirect(`${backTo}?error=${encodeURIComponent(errorMsg)}`);
  if (!result!.ok) redirect(`${backTo}?error=${encodeURIComponent(result!.error)}`);

  revalidatePath("/");
  revalidatePath("/deals");
  revalidatePath("/approve");

  if (!result!.dealId) redirect(`/capture?logged=note`);

  revalidatePath(`/deals/${result!.dealId}`);
  redirect(`/deals/${result!.dealId}?analyzed=1`);
}
