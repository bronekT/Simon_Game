import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Removes the stored Google tokens for the current user.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("google_accounts").delete().eq("user_id", user.id);
  }
  return NextResponse.redirect(new URL("/settings?google=disconnected", request.url), {
    status: 303,
  });
}
