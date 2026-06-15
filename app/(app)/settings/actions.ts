"use server";

import { randomBytes } from "crypto";
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

export async function saveSettings(form: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("settings").upsert(
    {
      user_id: user.id,
      company_name: str(form, "company_name"),
      showroom_address: str(form, "showroom_address"),
      email_signature: str(form, "email_signature"),
      monthly_goal: num(form, "monthly_goal"),
      commission_company: num(form, "commission_company"),
      commission_self: num(form, "commission_self"),
    },
    { onConflict: "user_id" },
  );

  revalidatePath("/settings");
  revalidatePath("/");
}

// Generate (or rotate) the read-only token used by the home-screen widget.
export async function generateWidgetToken() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const token = randomBytes(24).toString("hex");
  await supabase
    .from("settings")
    .upsert({ user_id: user.id, widget_token: token }, { onConflict: "user_id" });
  revalidatePath("/settings");
}

