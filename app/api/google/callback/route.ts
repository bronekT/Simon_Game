import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { oauthClient } from "@/lib/google/oauth";

// Handles the redirect back from Google: verifies state, exchanges the code for
// tokens, and stores them for the current user.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const savedState = jar.get("g_oauth_state")?.value;
  jar.delete("g_oauth_state");

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/settings?google=error", request.url));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Best-effort: read the connected Google email for display.
    let email: string | null = null;
    try {
      const oauth2 = google.oauth2({ version: "v2", auth: client });
      const me = await oauth2.userinfo.get();
      email = me.data.email ?? null;
    } catch {
      /* non-fatal */
    }

    await supabase.from("google_accounts").upsert(
      {
        user_id: user.id,
        email,
        access_token: tokens.access_token ?? null,
        refresh_token: tokens.refresh_token ?? null,
        expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        scope: tokens.scope ?? null,
      },
      { onConflict: "user_id" },
    );

    return NextResponse.redirect(new URL("/settings?google=connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/settings?google=error", request.url));
  }
}
