"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runPipeline } from "@/lib/pipeline";

export async function processTranscript(form: FormData) {
  const transcript = String(form.get("transcript") ?? "").trim();
  const attachRaw = String(form.get("deal_id") ?? "").trim();
  const attachDealId = attachRaw === "" ? null : attachRaw;

  if (transcript.length < 20) {
    redirect(
      `/capture?error=${encodeURIComponent("Please paste a transcript first.")}`,
    );
  }

  const supabase = await createClient();
  const result = await runPipeline(supabase, transcript, attachDealId);

  if (!result.ok) {
    // Flagged needs_review — surface the reason, don't proceed (Section 3).
    redirect(`/capture?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/");
  revalidatePath("/deals");
  revalidatePath(`/deals/${result.dealId}`);
  redirect(`/deals/${result.dealId}?analyzed=1`);
}
