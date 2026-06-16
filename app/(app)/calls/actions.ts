"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fromLocalInput, toLocalInput } from "@/lib/format";

// Push a lead's next call to tomorrow 10:00 (used for "no answer / call later").
export async function snoozeCall(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
  const dateStr = toLocalInput(tomorrow).slice(0, 10); // YYYY-MM-DD (Toronto)
  const iso = fromLocalInput(`${dateStr}T10:00`);

  const supabase = await createClient();
  await supabase.from("deals").update({ followup_at: iso }).eq("id", id);
  revalidatePath("/calls");
  revalidatePath("/");
}

// Clear the follow-up reminder (you reached them — nothing more to chase here).
export async function clearCall(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("deals")
    .update({ followup_at: null, followup_sent_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/calls");
  revalidatePath("/");
}
