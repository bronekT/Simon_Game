import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for server-side jobs that run WITHOUT a logged-in user
// (e.g. the scheduled ingestion). It bypasses RLS, so callers MUST scope every
// query/insert by user_id themselves. Never import this into client code.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin client needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
