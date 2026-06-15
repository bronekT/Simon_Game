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
