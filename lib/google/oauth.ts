import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { SupabaseClient } from "@supabase/supabase-js";

// Scopes: create Gmail DRAFTS only (never send), and insert Calendar events.
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

function redirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.APP_URL ?? "http://localhost:3000"}/api/google/callback`
  );
}

export function oauthClient(): OAuth2Client {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — see README Phase 3.",
    );
  }
  return new google.auth.OAuth2(id, secret, redirectUri());
}

export function authUrl(state: string): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline", // we need a refresh_token
    prompt: "consent", // force refresh_token on every connect
    scope: GOOGLE_SCOPES,
    state,
  });
}

// True if Google is configured (keys present). Used to show/hide the UI.
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Load the stored tokens for the current user and return an authed client that
// auto-refreshes. Returns null if the user hasn't connected Google yet.
export async function authedClientForUser(
  supabase: SupabaseClient,
): Promise<OAuth2Client | null> {
  const { data } = await supabase
    .from("google_accounts")
    .select("access_token, refresh_token, expiry")
    .maybeSingle();
  if (!data?.refresh_token) return null;

  const client = oauthClient();
  client.setCredentials({
    refresh_token: data.refresh_token,
    access_token: data.access_token ?? undefined,
    expiry_date: data.expiry ? new Date(data.expiry).getTime() : undefined,
  });

  // Persist refreshed access tokens back to the DB.
  client.on("tokens", (tokens) => {
    void supabase
      .from("google_accounts")
      .update({
        access_token: tokens.access_token ?? data.access_token,
        expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      })
      .eq("refresh_token", data.refresh_token);
  });

  return client;
}
