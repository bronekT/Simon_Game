// Supabase Scheduled Edge Function (SPEC.md Phase 4).
// It's a thin trigger: on a schedule it calls the app's /api/cron/ingest route,
// which reads new transcript emails from the Gmail label and runs the pipeline.
// The Gmail + AI logic lives in the Next.js app (where the keys + tokens are).
//
// Deploy:   supabase functions deploy ingest --no-verify-jwt
// Secrets:  supabase secrets set APP_URL=https://your-app CRON_SECRET=your-secret
// Schedule: in the Supabase dashboard (Edge Functions → ingest → Schedules),
//           e.g. every 15 minutes:  */15 * * * *
//
// (If you host on Vercel instead, vercel.json already schedules the same route.)

Deno.serve(async () => {
  const appUrl = Deno.env.get("APP_URL");
  const secret = Deno.env.get("CRON_SECRET");
  if (!appUrl || !secret) {
    return new Response(
      JSON.stringify({ error: "Set APP_URL and CRON_SECRET as function secrets." }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const res = await fetch(`${appUrl}/api/cron/ingest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
});
