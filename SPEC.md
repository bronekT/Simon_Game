# CLOSER — AI Sales OS · Build Brief for Claude Code

> Paste this as your first message to Claude Code, **or** save it as `SPEC.md` in the project root and tell Claude Code to treat it as the source of truth. I am **not a developer** — explain every manual step in plain language and never assume I know terminal/cloud conventions.

-----

## 0. What we are building

A personal, mobile-first **AI Sales Operating System** for a field salesperson (roofing / doors / exterior, Ontario, Canada). It turns every recorded call and in-person appointment into a structured deal, an AI analysis, ready-to-send follow-ups, a calendar event, and coaching — with the human approving anything that leaves the system.

Voice/transcripts come from a **Plaud** recorder (separate app) and arrive as text. This app does **not** store raw notes as a feature; it consumes transcripts and produces deals + actions.

-----

## 1. Core principles (apply to every decision)

1. **Human in the loop.** The AI never sends anything itself. Emails and calendar events are created as drafts in an approval queue and shown in a popup. They only reach Google after I tap ✓.
1. **App is the source of truth.** All data lives in our DB. We only *push out* to Google Calendar / Gmail (one-way). No two-way sync in the MVP.
1. **Value before plumbing.** Build the smallest useful slice first, prove it on real data, then layer automation.
1. **LLM understands language; the database does search.** Never feed the whole DB to the model. The model reads one transcript at a time; matching/lookup is SQL.
1. **Validate before acting.** Every AI output is parsed against a strict schema (Zod). Invalid output is flagged, never pushed.

-----

## 2. Tech stack (use exactly this)

- **Frontend + backend:** Next.js (App Router) + TypeScript + Tailwind CSS. Mobile-first. Built as a **PWA** (installable, standalone display, custom icon).
- **Database / auth / storage / cron:** Supabase (Postgres, Auth, Storage, Scheduled Edge Functions).
- **AI:** Anthropic API via the official SDK. Use **Claude Haiku** for extraction and **Claude Sonnet** for coaching/writing. Model IDs to start: `claude-haiku-4-5-20251001` and `claude-sonnet-4-6` — but **verify the current model names against the Anthropic docs first** and use the latest.
- **Integrations:** Gmail API (`drafts.create` only — never auto-send) and Google Calendar API (`events.insert`), called server-side via OAuth.
- **Validation:** Zod for all AI/API payloads.
- **Hosting:** Vercel.
- All secrets live server-side only. Never expose API keys to the client.

-----

## 3. How I want you to work

- **Build in phases (Section 9). After each phase: summarize what you built, list the exact steps for me to test it, then STOP and wait for my “go” before the next phase.**
- Before writing code in a phase, list any accounts/keys/manual setup I must do, with click-by-click instructions.
- Always create/update `.env.example` and tell me precisely which value to paste where.
- Ask before any destructive action (dropping tables, deleting files).
- Write a few sanity tests for the risky parts (AI parsing, idempotency, matching).
- Commit to git after each working phase with a clear message.
- Keep the code simple and readable; prefer clarity over cleverness. I will rely on you to maintain it.
- When something can fail (network, AI, Google), handle the error visibly (status + retry), never silently.

-----

## 4. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
APP_URL=
```

For Google: I will create a Google Cloud project, enable **Gmail API** and **Google Calendar API**, configure the OAuth consent screen in **Testing** mode, add myself as a test user (so I don’t need Google verification), and create OAuth credentials. Walk me through this when we reach the phase that needs it.

-----

## 5. Data model (create as SQL migrations, with Row-Level Security enabled, single-user for now)

**deals**

|field                                                        |type       |notes                                                    |
|-------------------------------------------------------------|-----------|---------------------------------------------------------|
|id                                                           |uuid pk    |                                                         |
|created_at / updated_at                                      |timestamptz|                                                         |
|client_name                                                  |text       |                                                         |
|address / phone / email                                      |text       |nullable                                                 |
|service_type                                                 |enum       |roofing, doors, windows, siding, insulation, other       |
|lead_source                                                  |enum       |company_lead, referral, self_generated, repeat, cold_call|
|status                                                       |enum       |new, booked, met, quoted, negotiation, won, lost, dead   |
|location_type                                                |enum       |home, showroom, phone, virtual (nullable)                |
|quote_price / cost / min_price / gross_profit / discount_room|numeric    |nullable                                                 |
|probability                                                  |int        |0–100                                                    |
|decision_maker / competitor / main_objection / next_action   |text       |nullable                                                 |
|followup_at                                                  |timestamptz|nullable                                                 |

**appointments** (one per captured call/meeting)
| id uuid pk · deal_id fk · created_at · record_type enum(booking_call, appointment, followup_call, note) · location_type enum · occurred_at · source enum(plaud, manual) · transcript text · summary text · analysis jsonb · talk_ratio int · sentiment text · score_rapport / score_discovery / score_pain / score_product / score_objection / score_closing / score_followup int · personal_hooks text[] |

**interactions** (timeline of every touch)
| id uuid pk · deal_id fk (nullable) · channel enum(call, email, sms, note, meeting, system) · direction enum(inbound, outbound, internal) · ref text (gmail_thread_id / phone / appointment_id) · summary text · occurred_at · match_confidence numeric · match_status enum(auto, confirmed, pending) |

**actions_queue** (everything that may leave the system)
| id uuid pk · deal_id fk · kind enum(email, sms, calendar_event) · payload jsonb · status enum(proposed, approved, synced, failed, dismissed) · idempotency_key text unique · external_id text (gmail_draft_id / event id) · retries int default 0 · created_at · synced_at |

**tasks** (checklist + calendar items)
| id uuid pk · deal_id fk (nullable) · type enum(call, send, visit, followup, other) · description text · due_at timestamptz · done boolean default false · calendar_event_id text |

**drafts**
| id uuid pk · deal_id fk · type enum(soft, urgency, price, competitor, financing, decision_maker, showroom_invite, last_chance, reactivation, confirmation) · channel enum(email, sms, call_script) · subject text · body text · gmail_draft_id text · status enum(draft, queued, created, sent_manually) |

**outcomes**
| id uuid pk · deal_id fk · result enum(won, lost) · reason enum(price, competitor, no_response, timing, financing, trust, product_mismatch, decision_maker, sales_mistake, unknown) · final_price / profit numeric · followups_count int · notes text · recorded_at |

**settings** (single row)
| id · company_name · showroom_address · email_signature · monthly_goal numeric · commission_company numeric · commission_self numeric |

-----

## 6. The reliable pipeline (this is the heart of the system)

For each incoming transcript:

1. **Ingest** — a transcript arrives (later from Plaud→Zapier→inbox; in early phases, pasted/uploaded manually). Store raw text on an `appointments` row.
1. **Classify + match** — call Claude (Haiku). The model returns the structured object in Section 7. Use its identifiers + the **matching ladder** (Section 8) via SQL to attach to an existing deal or create a new one. Never guess silently.
1. **Validate** — parse the model output with Zod. If invalid, mark the appointment `needs_review` and do not proceed to actions.
1. **Branch by `record_type`** — booking_call → create/update deal + propose calendar event + propose confirmation SMS. appointment → full analysis + scores + propose follow-up(s) + propose calendar follow-up. followup_call → update status/price/objection + propose next step. note → just log.
1. **Queue actions** — proposed emails / SMS / events go into `actions_queue` with status `proposed` and a unique `idempotency_key`. **Nothing is sent to Google yet.**
1. **Approve (UI)** — the approval screen lists proposed actions; tapping one opens a popup with the editable draft. On ✓ → status `approved`.
1. **Push** — server calls Gmail `drafts.create` (a draft, not a send) or Calendar `events.insert`, using the idempotency key so retries never duplicate. Save the returned id to `external_id` (and to the deal/task). Status → `synced`. On error → `failed`, increment `retries`, surface a retry button.

-----

## 7. AI extraction contract (strict JSON, validated with Zod)

The extraction call must return **only** this JSON (no prose):

```jsonc
{
  "record_type": "booking_call | appointment | followup_call | note",
  "location_type": "home | showroom | phone | virtual | null",
  "client": { "name": "string|null", "phone": "string|null",
              "email": "string|null", "address": "string|null" },
  "service_type": "roofing|doors|windows|siding|insulation|other|null",
  "match_hints": ["short strings that help find an existing deal"],
  "summary": "2-3 sentence client summary: what they want, pain, urgency",
  "objections": ["..."],
  "competitor": "string|null",
  "decision_maker": "string|null",
  "budget_signal": "string|null",
  "close_probability": 0,
  "scores": { "rapport":0,"discovery":0,"pain":0,"product":0,
              "objection":0,"closing":0,"followup":0 },
  "talk_ratio": 0,                 // % of time the SALESPERSON spoke
  "sentiment": "string",
  "personal_hooks": ["personal details to use in follow-ups"],
  "what_went_well": "string",
  "what_went_wrong": "string",
  "next_action": "string",
  "followup_at": "ISO datetime | null",
  "proposed_event": { "title":"", "start":"ISO", "location":"", "notes":"" } | null,
  "drafts": [
    { "type":"price|competitor|financing|...", "channel":"email|sms",
      "subject":"", "body":"" }
  ],
  "confirmation_sms": "string | null"   // only for booking_call
}
```

- **Extraction** (Haiku): reads the full transcript, returns the object above.
- **Coaching/writing** (Sonnet): for `appointment`, generate the personalized follow-up drafts and coaching using the **summary + hooks**, not the full transcript again (cost control). Inject `personal_hooks` into follow-ups so they feel personal.
- For `booking_call`, fill `confirmation_sms` by `location_type`: **home** → “confirming I’ll come to {address} on {day/time}…”; **showroom** → “confirming your showroom visit at {settings.showroom_address}, parking…”. Keep it short and warm, signed with `settings.email_signature`.
- Detecting the meeting/promise time is just the `proposed_event` / `followup_at` field — not a separate call.

-----

## 8. Matching ladder (identity resolution — done in SQL, not by the LLM)

Given `match_hints` + client fields, find the deal in this priority order:

1. Exact **phone** match → auto-attach.
1. Known **gmail thread** (for email replies) → auto-attach.
1. **Name + recency/status** (recent activity, or status in quoted/negotiation) → propose with a confidence score.
1. Otherwise → create the interaction with `match_status=pending` and show a **one-tap disambiguation card** listing the top 2–3 candidate deals. Never attach on name alone.

Note: phone numbers are **not** present in Plaud audio transcripts. For an unnamed inbound call, rely on content + recency + the one-tap card, or a spoken tag (“this was the Smith roofing deal”). True automatic inbound-by-number matching is a later upgrade (route calls through a business-number API).

-----

## 9. Build phases (do them in order, stop after each)

**Phase 0 — Skeleton + DB + deploy.** Scaffold Next.js + Tailwind + Supabase. Create all tables (Section 5) as migrations with RLS. Build three screens with mock/manual data: **Dashboard**, **Deals list**, **Deal detail**. Set up auth (single user). Deploy to Vercel. *Acceptance:* I can add a deal manually and see it rendered nicely on my phone.

**Phase 1 — Manual transcript → AI analysis (prove the value).** Add a screen to paste/upload a transcript. Implement the extraction call (Section 7) + Zod validation + the branching, writing results to `appointments` and updating the deal. Show the analysis, scores, talk-ratio, summary on the deal card. *No Google yet.* *Acceptance:* I paste a real transcript and get a genuinely useful structured analysis + draft follow-up I can copy.

**Phase 2 — Approval queue + popups.** Build `actions_queue` + the **“To approve”** screen and the **popup/modal** showing each draft (email / SMS / event) with edit + ✓. SMS popup has Copy + an `sms:` deep link (“Open in Messages”). *Acceptance:* AI proposals appear in the queue; I can open, edit, and approve them (no external send yet).

**Phase 3 — Direct Gmail + Calendar push.** Google OAuth (walk me through Cloud setup). On ✓: `drafts.create` and `events.insert` with idempotency keys; store ids; show status Synced/Failed + retry. *Acceptance:* Approving an email creates a real Gmail **draft**; approving an event creates a real Calendar event with location + reminder; re-running never duplicates.

**Phase 4 — Ingestion automation + in-app calendar/checklist.** Supabase Scheduled Function that reads new transcripts from the inbox (Gmail label / Drive), runs the pipeline automatically into the queue. Build the in-app **calendar/agenda + checklist (tasks with checkboxes)**, pushing items one-way to Google. *Acceptance:* A new transcript in my inbox auto-produces a deal + queued actions; my checklist shows today’s tasks and syncs out.

**Phase 5 — Automations + coaching + PWA polish.** Cron rules: no follow-up 3 days → `at_risk`; dead lead 30 days → reactivation draft. Morning brief (top-3 money moves). Monthly coach report from `outcomes`/`interactions`. Commission/OTE tracker from `settings.monthly_goal`. Finalize PWA manifest (icon, standalone) + a read-only `/api/widget` JSON endpoint (top-3 moves, next appointment, pipeline) for a Scriptable home-screen widget. *Acceptance:* The app installs to my home screen with an icon; the widget endpoint returns today’s summary.

-----

## 10. Design / UX

- **Dark, Apple-minimal.** Background near-black `#0A0A0C`, text `#F5F5F7`, muted grey `#8A8A90`, hairline dividers `rgba(255,255,255,.09)`, one warm accent `#E9A23B`. Status colors: green `#3FD089` (won/hot), amber `#F5B73D` (follow-up), red `#F0565D` (at-risk), blue `#5B8DEF` (tasks).
- Clean sans typography, clear hierarchy, generous spacing, rounded cards, large tap targets. No clutter — one screen, one job.
- A persistent **voice bar** at the bottom for quick notes/commands.
- Screens: Dashboard (Money Moves + commission), To-Approve (queue + popups), Deals list, Deal detail (data + AI analysis + scores + talk-ratio + timeline), AI Closer chat, Calendar+checklist, Coach report, Settings.

-----

## 11. Start now

Begin with **Phase 0**. First: (a) confirm the stack and the exact accounts/keys I need to create for Phase 0, with step-by-step instructions; (b) verify the current Anthropic model IDs from the docs; (c) scaffold the project, create the Supabase schema as migrations, build the three core screens with manual data, set up the PWA shell, and deploy to Vercel. Then **stop and tell me exactly how to test it** before we continue to Phase 1.