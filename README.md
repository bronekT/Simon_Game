# CLOSER — your AI Sales OS

A personal, mobile-first app that turns recorded calls and appointments into
structured deals, AI analysis, ready-to-send follow-ups, calendar events, and
coaching — with you approving anything that leaves the system.

`SPEC.md` in this folder is the source of truth for the whole project.

---

## Phase 3 ✅ — Gmail drafts + Calendar events

Approving an email creates a real **Gmail draft** (never auto-sent); approving an
event creates a real **Google Calendar event** with location + reminder.
Re-running never duplicates (idempotency keys). Status shows **Synced / Failed**
with a Retry button. SMS stays manual (Copy / Open in Messages).

**This is optional to set up now — everything else works without it.** When you're
ready, connect Google:

1. **Run the new migration:** Supabase → SQL Editor → paste all of
   `supabase/migrations/0002_google.sql` → Run.
2. **Create a Google Cloud project:** https://console.cloud.google.com → top bar
   project dropdown → **New Project** → name it `closer` → Create.
3. **Enable the APIs:** left menu **APIs & Services → Library** → search and
   **Enable** both **Gmail API** and **Google Calendar API**.
4. **OAuth consent screen:** APIs & Services → **OAuth consent screen** →
   **External** → fill app name + your email → **Save**. Keep it in **Testing**
   mode and under **Test users** add your own Google email (so you don't need
   Google to verify the app).
5. **Create credentials:** APIs & Services → **Credentials → Create Credentials →
   OAuth client ID → Web application**. Under **Authorized redirect URIs** add:
   - `http://localhost:3000/api/google/callback` (local), and
   - `https://YOUR-VERCEL-URL/api/google/callback` (production).
   Create → copy the **Client ID** and **Client secret**.
6. **Paste into `.env.local`** (and Vercel env vars):
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
   APP_URL=http://localhost:3000
   ```
   (On Vercel use your real URL for the last two.)
7. Restart the app → **Settings → Connect Google** → approve. Now approving an
   email/event pushes it to Gmail/Calendar.

> Scopes requested: Gmail **compose** (drafts only — it cannot send) and Calendar
> **events**. Your tokens are stored only in your own Supabase, server-side.

---

## Phase 2 ✅ — Approval queue

Every AI-proposed email / SMS / calendar event lands in the **To approve** screen.
Tap one to open a popup, **edit** it, then **Approve** (or Save / Dismiss).
Nothing leaves the system on its own. No setup needed — it uses the Phase 0 DB.

---

## Where we are: Phase 1 ✅

Paste a real call/meeting transcript and the app turns it into a deal, a useful
AI analysis (summary, sentiment, talk-ratio, 7 call scores, what went
well/wrong, coaching), and **draft follow-ups you can copy**. Nothing is sent to
email or calendar yet — that comes in Phases 2–3.

**To use Phase 1 you need an Anthropic API key:**

1. Go to https://console.anthropic.com → **Settings → API Keys → Create Key**.
   Copy the key (starts with `sk-ant-`).
2. Open `.env.local` and paste it after `ANTHROPIC_API_KEY=`.
3. On Vercel, add the same `ANTHROPIC_API_KEY` under
   Project → Settings → Environment Variables, then redeploy.
4. Restart `npm run dev`.

**Try it:** tap **Capture** (bottom bar) → paste a transcript → **Analyze
transcript**. In ~10–20s you land on the deal with its analysis and copyable
drafts. If the AI output is ever malformed, the transcript is saved and flagged
for review and nothing is acted on — you'll see why.

> Models used: `claude-haiku-4-5` for extraction (cheap) and `claude-sonnet-4-6`
> for writing the personalized follow-ups (Section 7 of SPEC.md).

---

## Phase 0 ✅

This phase is the skeleton everything else builds on:

- Next.js + TypeScript + Tailwind, mobile-first, installable as a **PWA**.
- **Supabase** database with all tables from the spec, protected by Row-Level
  Security (you only ever see your own data).
- Single-user **login**.
- Three screens with real data you can add by hand: **Dashboard**, **Deals
  list**, **Deal detail**, plus an **Add deal** form.

No AI and no Google yet — those come in later phases.

> **You don't need to be a developer to follow this.** Do the steps in order.
> Each one says exactly what to click and where to paste things. Total time:
> about 20–30 minutes.

---

## What you'll need

- A free **Supabase** account → https://supabase.com
- A free **Vercel** account (for putting it online) → https://vercel.com
- **Node.js 18+** installed on your computer if you want to run it locally first
  → https://nodejs.org (download the "LTS" version, click through the installer).

---

## Step 1 — Create your Supabase project

1. Go to https://supabase.com and sign in.
2. Click **New project**.
3. Give it a name (e.g. `closer`), set a strong **database password** (save it
   somewhere — you won't need it day-to-day, but don't lose it), pick the region
   closest to you, and click **Create new project**.
4. Wait ~2 minutes for it to finish setting up.

## Step 2 — Create the database tables

1. In your Supabase project, click **SQL Editor** in the left sidebar.
2. Click **+ New query**.
3. Open the file `supabase/migrations/0001_init.sql` from this project, copy
   **all** of its contents, and paste it into the editor.
4. Click **Run** (bottom right). You should see "Success. No rows returned."
   That created every table the app needs, with security turned on.

## Step 3 — Get your keys

1. In Supabase, click **Project Settings** (gear icon) → **API**.
2. You'll see three values you need:
   - **Project URL**
   - **anon public** key
   - **service_role** key (this one is secret — never share it)
3. In this project, make a copy of `.env.example` and name the copy
   `.env.local`. Open `.env.local` and paste each value next to the matching
   name:

   ```
   NEXT_PUBLIC_SUPABASE_URL=        ← Project URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=   ← anon public
   SUPABASE_SERVICE_ROLE_KEY=       ← service_role
   APP_URL=http://localhost:3000
   ```

   Leave the Anthropic and Google lines blank for now.

## Step 4 — Create your single user

This app is just for you, so you make one login by hand:

1. In Supabase, click **Authentication** → **Users** → **Add user** → **Create
   new user**.
2. Enter your email and a password, and **turn on "Auto Confirm User"** so you
   can log in right away.
3. Click **Create user**. That email + password is how you'll sign in.

## Step 5 — Run it on your computer

In a terminal, from this project folder:

```bash
npm install      # one time only — downloads what the app needs
npm run dev      # starts the app
```

Open **http://localhost:3000** in your browser. Sign in with the email and
password from Step 4.

## Step 6 — Try it (this is the Phase 0 test)

1. Tap **Add** (bottom bar) or **+ Add**.
2. Fill in at least a **Client name**, pick a **Status**, add a **Quote price**
   and a **Next action**, then **Save deal**.
3. You should land on the deal's detail page. Go to **Deals** to see it in the
   list, and **Home** to see it under "Money Moves" with your pipeline total.

✅ **If you can add a deal and see it rendered nicely, Phase 0 works.**

## Step 7 — Install it on your phone (PWA)

1. Deploy first (Step 8), then open your live URL on your phone.
2. **iPhone (Safari):** Share → **Add to Home Screen**.
   **Android (Chrome):** menu → **Install app / Add to Home screen**.
3. It opens full-screen with its own icon, like a normal app.

> The app icon and offline support are basic for now — they get finalized in
> Phase 5.

## Step 8 — Put it online with Vercel

1. Push this project to a GitHub repo (if it isn't already).
2. Go to https://vercel.com → **Add New… → Project** → import that repo.
3. Before deploying, open **Environment Variables** and add the same four names
   and values from your `.env.local` (use your real Vercel URL for `APP_URL`,
   e.g. `https://closer-yourname.vercel.app`).
4. Click **Deploy**. When it's done, open the URL and sign in.

---

## Project layout (for reference)

```
app/
  (app)/            screens you see after logging in (dashboard, deals, capture, detail)
  login/            sign-in screen
  auth/signout/     sign-out endpoint
components/         reusable UI (cards, badges, bottom nav, draft cards)
lib/
  ai/               Anthropic calls + the strict Section 7 schema (extract, write)
  supabase/         database connection helpers
  pipeline.ts       transcript → analysis → deal/drafts pipeline (Section 6)
  match.ts          identity-resolution ladder (Section 8)
  types.ts          shared data types
  format.ts         money/date formatting
supabase/
  migrations/       the SQL that builds your database
tests/              sanity tests (AI parsing, matching)
public/             PWA manifest, icons, service worker
SPEC.md             the full project brief (source of truth)
```

---

## What's next — Phase 2

The approval queue: AI-proposed emails / SMS / calendar events show up in a
"To approve" screen as editable drafts in a popup. You edit and tap ✓ to approve
them (still nothing leaves the system until Phase 3). We'll do it when you say
"go".

## Running the tests

```bash
npm test
```

Sanity tests cover the risky parts (Section 3): AI-output Zod validation, JSON
extraction from messy model replies, and the matching ladder.
