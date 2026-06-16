"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Toggle whether a won deal's commission has actually been received.
export async function toggleCommissionPaid(form: FormData) {
  const id = String(form.get("id") ?? "");
  const paid = String(form.get("paid") ?? "") === "true";
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("deals").update({ commission_paid: !paid }).eq("id", id);
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
}
