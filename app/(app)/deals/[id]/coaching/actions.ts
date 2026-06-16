"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateDeepCoaching } from "@/lib/ai/coach";

// Generate (or regenerate) the detailed coaching breakdown for the deal's
// latest appointment that has a usable transcript. Robust: any failure shows a
// message instead of crashing the page.
export async function generate(form: FormData) {
  const dealId = String(form.get("deal_id") ?? "");
  if (!dealId) return;
  const supabase = await createClient();

  let errorMsg = "";
  try {
    const { data: appt } = await supabase
      .from("appointments")
      .select("id, transcript, analysis")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const transcript = (appt?.transcript as string) ?? "";
    if (!appt || transcript.trim().length < 20) {
      errorMsg = "No appointment transcript to review yet — capture one first.";
    } else {
      const text = await generateDeepCoaching(transcript);
      const analysis = { ...((appt.analysis as Record<string, unknown>) ?? {}), deep_coaching: text };
      await supabase.from("appointments").update({ analysis }).eq("id", appt.id);
    }
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "Generation failed — please try again.";
  }

  revalidatePath(`/deals/${dealId}/coaching`);
  if (errorMsg) redirect(`/deals/${dealId}/coaching?error=${encodeURIComponent(errorMsg)}`);
  redirect(`/deals/${dealId}/coaching`);
}
