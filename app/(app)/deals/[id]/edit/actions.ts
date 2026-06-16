"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}
function num(form: FormData, key: string): number | null {
  const v = str(form, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function updateDeal(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;

  const followup = str(form, "followup_at");
  const supabase = await createClient();

  await supabase
    .from("deals")
    .update({
      client_name: str(form, "client_name") ?? "Unnamed",
      address: str(form, "address"),
      phone: str(form, "phone"),
      email: str(form, "email"),
      door_type: str(form, "door_type"),
      door_count: num(form, "door_count"),
      status: str(form, "status") ?? "new",
      location_type: str(form, "location_type"),
      quote_price: num(form, "quote_price"),
      probability: num(form, "probability"),
      decision_maker: str(form, "decision_maker"),
      competitor: str(form, "competitor"),
      main_objection: str(form, "main_objection"),
      next_action: str(form, "next_action"),
      followup_at: followup ? new Date(followup).toISOString() : null,
    })
    .eq("id", id);

  revalidatePath(`/deals/${id}`);
  revalidatePath("/deals");
  revalidatePath("/");
  redirect(`/deals/${id}`);
}
