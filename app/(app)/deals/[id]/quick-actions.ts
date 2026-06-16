"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
