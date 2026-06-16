"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateDeepCoaching } from "@/lib/ai/coach";

// Generate (or regenerate) the detailed coaching breakdown for the deal's
// latest analyzed appointment, and store it on that appointment.
export async function generate(form: FormData) {
  const dealId = String(form.get("deal_id") ?? "");
  if (!dealId) return;
  const supabase = await createClient();

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, transcript, analysis")
    .eq("deal_id", dealId)
    .not("record_type", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!appt?.transcript) return;

  const text = await generateDeepCoaching(appt.transcript as string);
  const analysis = { ...((appt.analysis as Record<string, unknown>) ?? {}), deep_coaching: text };
  await supabase.from("appointments").update({ analysis }).eq("id", appt.id);

  revalidatePath(`/deals/${dealId}/coaching`);
}
