import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /auth/signout — ends the session and returns to the login screen.
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
