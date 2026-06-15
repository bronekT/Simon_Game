"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Reads a form field, returning null for empty strings (so optional columns
// stay NULL instead of becoming "").
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

export async function createDeal(form: FormData) {
  const client_name = str(form, "client_name");
  if (!client_name) {
    // Required by the DB too, but fail early with a clear message.
    throw new Error("Client name is required.");
  }

  const followupRaw = str(form, "followup_at");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .insert({
      client_name,
      address: str(form, "address"),
      phone: str(form, "phone"),
      email: str(form, "email"),
      service_type: "doors",
      door_type: str(form, "door_type"),
      door_count: num(form, "door_count"),
      lead_source: str(form, "lead_source"),
      status: str(form, "status") ?? "new",
      location_type: str(form, "location_type"),
      quote_price: num(form, "quote_price"),
      probability: num(form, "probability"),
      next_action: str(form, "next_action"),
      followup_at: followupRaw ? new Date(followupRaw).toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/deals");
  revalidatePath("/");
  redirect(`/deals/${data.id}`);
}
