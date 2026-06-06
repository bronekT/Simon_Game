"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Single-user email + password sign-in (SPEC.md Phase 0).
// On error we redirect back to /login with a message in the query string so the
// failure is visible (Section 3: never fail silently).
export async function signIn(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Enter your email and password.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}
