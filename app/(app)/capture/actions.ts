"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeAppointment } from "@/lib/pipeline";

// Re-run analysis for a transcript that failed or got stuck. Synchronous and
// uses the service-role client (the reliable path), then lands on the deal.
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
    result = await analyzeAppointment(createAdminClient(), user.id, appointmentId);
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
