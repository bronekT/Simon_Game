"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Cycle the payment stage: unpaid → 1st 50% → paid in full → unpaid.
export async function cyclePayment(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("payment_stage").eq("id", id).maybeSingle();
  const current = (data?.payment_stage as number) ?? 0;
  const next = (current + 1) % 3;
  await supabase.from("deals").update({ payment_stage: next }).eq("id", id);
  revalidatePath("/earnings");
  revalidatePath("/");
}

// Set a manual commission amount for a deal (overrides the ~9% estimate).
export async function setCommission(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const raw = String(form.get("commission") ?? "").trim();
  const value = raw === "" ? null : Number(raw);
  const supabase = await createClient();
  await supabase
    .from("deals")
    .update({ commission: value != null && Number.isFinite(value) ? value : null })
    .eq("id", id);
  revalidatePath("/earnings");
  revalidatePath("/");
  revalidatePath(`/deals/${id}`);
}
