"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateMeetingReview } from "@/lib/ai/coach";

// Generate a detailed Russian review for ONE meeting and SAVE it onto the
// appointment (analysis.ru_review), so reading it again later costs no tokens.
export async function reviewMeeting(form: FormData) {
  const id = String(form.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: appt } = await supabase
    .from("appointments")
    .select("transcript, analysis")
    .eq("id", id)
    .maybeSingle();
  if (!appt?.transcript || (appt.transcript as string).trim().length < 20) return;

  let review = "";
  try {
    review = await generateMeetingReview(appt.transcript as string);
  } catch {
    return;
  }
  if (!review) return;

  const analysis = { ...((appt.analysis as Record<string, unknown>) ?? {}), ru_review: review };
  await createAdminClient().from("appointments").update({ analysis }).eq("id", id);
  revalidatePath("/coach");
}
