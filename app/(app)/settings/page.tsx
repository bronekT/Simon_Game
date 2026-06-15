import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import { saveSettings, generateWidgetToken } from "./actions";
import { googleConfigured } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const { google: googleStatus } = await searchParams;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const supabase = await createClient();

  const { data: s } = await supabase.from("settings").select("*").maybeSingle();
  const { data: g } = await supabase
    .from("google_accounts")
    .select("email")
    .maybeSingle();

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <Link href="/" className="text-sm text-accent">
          Done
        </Link>
      </header>

      {/* Google connection (Phase 3) */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Google (Gmail + Calendar)</h2>
        <Card>
          {!googleConfigured() ? (
            <p className="text-sm text-muted">
              Google isn&apos;t set up yet. Add <code>GOOGLE_CLIENT_ID</code> and{" "}
              <code>GOOGLE_CLIENT_SECRET</code> — see README Phase 3.
            </p>
          ) : g ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-won">Connected ✓</p>
                <p className="truncate text-xs text-muted">{g.email}</p>
              </div>
              <form action="/api/google/disconnect" method="post">
                <button className="rounded-full border border-hairline px-3 py-1.5 text-xs text-risk">
                  Disconnect
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted">Not connected.</p>
              <a
                href="/api/google/connect"
                className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-bg"
              >
                Connect Google
              </a>
            </div>
          )}
          {googleStatus === "error" && (
            <p className="mt-2 text-xs text-risk">Connection failed — please try again.</p>
          )}
          {googleStatus === "connected" && (
            <p className="mt-2 text-xs text-won">Google connected.</p>
          )}
        </Card>
      </section>

      {/* Home-screen widget (Phase 5) */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Home-screen widget</h2>
        <Card>
          {s?.widget_token ? (
            <>
              <p className="text-xs text-muted">
                Read-only link for a Scriptable widget (top-3 moves, next
                appointment, pipeline). Keep it private.
              </p>
              <p className="mt-2 break-all rounded-lg bg-white/5 p-2 text-xs">
                {`${appUrl}/api/widget?token=${s.widget_token}`}
              </p>
              <form action={generateWidgetToken} className="mt-2">
                <button className="rounded-full border border-hairline px-3 py-1.5 text-xs text-text">
                  Regenerate (invalidates old link)
                </button>
              </form>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted">No widget link yet.</p>
              <form action={generateWidgetToken}>
                <button className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-bg">
                  Generate link
                </button>
              </form>
            </div>
          )}
        </Card>
      </section>

      {/* Business settings */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Business</h2>
        <form action={saveSettings} className="flex flex-col gap-4">
          <Field label="Company name">
            <input name="company_name" defaultValue={s?.company_name ?? ""} className="w-full px-3 py-2.5" />
          </Field>
          <Field label="Showroom address">
            <input name="showroom_address" defaultValue={s?.showroom_address ?? ""} className="w-full px-3 py-2.5" />
          </Field>
          <Field label="Email signature">
            <textarea name="email_signature" defaultValue={s?.email_signature ?? ""} rows={3} className="w-full px-3 py-2.5 text-sm" />
          </Field>
          <Field label="Monthly goal (CAD)">
            <input name="monthly_goal" type="number" inputMode="decimal" defaultValue={s?.monthly_goal ?? ""} className="w-full px-3 py-2.5" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Commission — company %">
              <input name="commission_company" type="number" inputMode="decimal" defaultValue={s?.commission_company ?? ""} className="w-full px-3 py-2.5" />
            </Field>
            <Field label="Commission — me %">
              <input name="commission_self" type="number" inputMode="decimal" defaultValue={s?.commission_self ?? ""} className="w-full px-3 py-2.5" />
            </Field>
          </div>
          <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
        </form>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}
