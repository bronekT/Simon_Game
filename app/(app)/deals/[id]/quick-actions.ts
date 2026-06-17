"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { produceFollowups } from "@/lib/followups";

// Change status right on the deal — no Edit screen needed.
export async function setStatus(form: FormData) {
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!id || !status) return;
  const supabase = await createClient();
  await supabase.from("deals").update({ status }).eq("id", id);
  revalidatePath(`/deals/${id}`);
  revalidatePath("/deals");
  revalidatePath("/");
}

// Follow-up counter +1 / -1 (never below 0).
export async function bumpFollowups(form: FormData) {
  const id = String(form.get("id") ?? "");
  const delta = Number(form.get("delta") ?? "0");
  if (!id) return;
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("followups_count").eq("id", id).maybeSingle();
  const current = (data?.followups_count as number) ?? 0;
  const next = Math.max(0, current + (Number.isFinite(delta) ? delta : 0));
  await supabase.from("deals").update({ followups_count: next }).eq("id", id);
  revalidatePath(`/deals/${id}`);
}

export async function deleteDeal(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("deals").delete().eq("id", id);
  revalidatePath("/deals");
  revalidatePath("/");
  redirect("/deals");
}

// Generate fresh close-oriented follow-ups for this deal on demand (when none
// exist, or you want new ones). Uses the latest appointment's analysis.
export async function generateFollowups(form: FormData) {
  const dealId = String(form.get("id") ?? "");
  if (!dealId) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // One AI call (service-role client = reliable), shared with the capture flow.
  const result = await produceFollowups(createAdminClient(), user.id, dealId);
  if (!result.ok) {
    redirect(`/deals/${dealId}?error=${encodeURIComponent("Analyze an appointment first, or try again.")}`);
  }

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/approve");
  redirect(`/deals/${dealId}?analyzed=1`);
}

