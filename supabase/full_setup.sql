-- CLOSER — full database setup (run ONCE on a fresh Supabase project).
-- Combines migrations 0001–0005. Paste all of this into Supabase SQL Editor and Run.


-- ============================================================
-- supabase/migrations/0001_init.sql
-- ============================================================
-- ============================================================================
-- CLOSER — initial schema (Phase 0)
-- SPEC.md Section 5. Single-user for now: every row is owned by an auth user,
-- and Row-Level Security ensures you can only ever see/touch your own rows.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type service_type   as enum ('roofing','doors','windows','siding','insulation','other');
create type lead_source    as enum ('company_lead','referral','self_generated','repeat','cold_call');
create type deal_status     as enum ('new','booked','met','quoted','negotiation','won','lost','dead');
create type location_type   as enum ('home','showroom','phone','virtual');

create type record_type     as enum ('booking_call','appointment','followup_call','note');
create type appt_source     as enum ('plaud','manual');

create type channel         as enum ('call','email','sms','note','meeting','system');
create type direction       as enum ('inbound','outbound','internal');
create type match_status     as enum ('auto','confirmed','pending');

create type action_kind     as enum ('email','sms','calendar_event');
create type action_status    as enum ('proposed','approved','synced','failed','dismissed');

create type task_type        as enum ('call','send','visit','followup','other');

create type draft_type       as enum ('soft','urgency','price','competitor','financing','decision_maker','showroom_invite','last_chance','reactivation','confirmation');
create type draft_channel    as enum ('email','sms','call_script');
create type draft_status     as enum ('draft','queued','created','sent_manually');

create type outcome_result   as enum ('won','lost');
create type outcome_reason   as enum ('price','competitor','no_response','timing','financing','trust','product_mismatch','decision_maker','sales_mistake','unknown');

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- deals
-- ---------------------------------------------------------------------------
create table deals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  client_name    text not null,
  address        text,
  phone          text,
  email          text,
  service_type   service_type,
  lead_source    lead_source,
  status         deal_status not null default 'new',
  location_type  location_type,
  quote_price    numeric,
  cost           numeric,
  min_price      numeric,
  gross_profit   numeric,
  discount_room  numeric,
  probability    int check (probability between 0 and 100),
  decision_maker text,
  competitor     text,
  main_objection text,
  next_action    text,
  followup_at    timestamptz
);
create trigger deals_set_updated_at before update on deals
  for each row execute function set_updated_at();
create index deals_user_idx       on deals (user_id);
create index deals_status_idx     on deals (user_id, status);
create index deals_followup_idx   on deals (user_id, followup_at);
create index deals_phone_idx      on deals (user_id, phone);

-- ---------------------------------------------------------------------------
-- appointments (one per captured call/meeting)
-- ---------------------------------------------------------------------------
create table appointments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id          uuid references deals(id) on delete cascade,
  created_at       timestamptz not null default now(),
  record_type      record_type,
  location_type    location_type,
  occurred_at      timestamptz,
  source           appt_source not null default 'manual',
  transcript       text,
  summary          text,
  analysis         jsonb,
  talk_ratio       int,
  sentiment        text,
  score_rapport    int,
  score_discovery  int,
  score_pain       int,
  score_product    int,
  score_objection  int,
  score_closing    int,
  score_followup   int,
  personal_hooks   text[],
  needs_review     boolean not null default false
);
create index appointments_deal_idx on appointments (deal_id);
create index appointments_user_idx on appointments (user_id);

-- ---------------------------------------------------------------------------
-- interactions (timeline of every touch)
-- ---------------------------------------------------------------------------
create table interactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id          uuid references deals(id) on delete set null,
  channel          channel,
  direction        direction,
  ref              text,
  summary          text,
  occurred_at      timestamptz not null default now(),
  match_confidence numeric,
  match_status     match_status
);
create index interactions_deal_idx on interactions (deal_id);
create index interactions_user_idx on interactions (user_id);

-- ---------------------------------------------------------------------------
-- actions_queue (everything that may leave the system)
-- ---------------------------------------------------------------------------
create table actions_queue (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id          uuid references deals(id) on delete cascade,
  kind             action_kind not null,
  payload          jsonb not null,
  status           action_status not null default 'proposed',
  idempotency_key  text not null unique,
  external_id      text,
  retries          int not null default 0,
  created_at       timestamptz not null default now(),
  synced_at        timestamptz
);
create index actions_queue_deal_idx   on actions_queue (deal_id);
create index actions_queue_status_idx on actions_queue (user_id, status);

-- ---------------------------------------------------------------------------
-- tasks (checklist + calendar items)
-- ---------------------------------------------------------------------------
create table tasks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id            uuid references deals(id) on delete set null,
  type               task_type,
  description        text,
  due_at             timestamptz,
  done               boolean not null default false,
  calendar_event_id  text
);
create index tasks_deal_idx on tasks (deal_id);
create index tasks_due_idx  on tasks (user_id, due_at);

-- ---------------------------------------------------------------------------
-- drafts
-- ---------------------------------------------------------------------------
create table drafts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id         uuid references deals(id) on delete cascade,
  type            draft_type,
  channel         draft_channel,
  subject         text,
  body            text,
  gmail_draft_id  text,
  status          draft_status not null default 'draft'
);
create index drafts_deal_idx on drafts (deal_id);

-- ---------------------------------------------------------------------------
-- outcomes
-- ---------------------------------------------------------------------------
create table outcomes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id          uuid references deals(id) on delete cascade,
  result           outcome_result,
  reason           outcome_reason,
  final_price      numeric,
  profit           numeric,
  followups_count  int,
  notes            text,
  recorded_at      timestamptz not null default now()
);
create index outcomes_deal_idx on outcomes (deal_id);

-- ---------------------------------------------------------------------------
-- settings (single row per user)
-- ---------------------------------------------------------------------------
create table settings (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  company_name       text,
  showroom_address   text,
  email_signature    text,
  monthly_goal       numeric,
  commission_company numeric,
  commission_self    numeric
);

-- ============================================================================
-- Row-Level Security — every table is owner-scoped to auth.uid()
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'deals','appointments','interactions','actions_queue',
    'tasks','drafts','outcomes','settings'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format($f$
      create policy %1$s_owner on %1$I
        for all
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- ============================================================
-- supabase/migrations/0002_google.sql
-- ============================================================
-- ============================================================================
-- CLOSER — Google account tokens (Phase 3)
-- Stores the OAuth tokens for the single user so the server can create Gmail
-- drafts and Calendar events on their behalf. Owner-scoped via RLS.
-- ============================================================================

create table google_accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  email         text,
  access_token  text,
  refresh_token text,
  expiry        timestamptz,
  scope         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger google_accounts_set_updated_at before update on google_accounts
  for each row execute function set_updated_at();

alter table google_accounts enable row level security;
create policy google_accounts_owner on google_accounts
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- supabase/migrations/0003_automations.sql
-- ============================================================
-- ============================================================================
-- CLOSER — automations + widget (Phase 5)
-- ============================================================================

-- Flag set by the daily automation when a deal goes quiet (SPEC.md Phase 5).
alter table deals add column if not exists at_risk boolean not null default false;

-- Read-only token for the home-screen widget endpoint (/api/widget?token=...).
alter table settings add column if not exists widget_token text unique;

-- ============================================================
-- supabase/migrations/0004_commission.sql
-- ============================================================
-- ============================================================================
-- CLOSER — commission tracking (UI improvement)
-- Lets you mark a won deal's commission as actually received ("realized").
-- ============================================================================

alter table deals add column if not exists commission_paid boolean not null default false;

-- ============================================================
-- supabase/migrations/0005_doors.sql
-- ============================================================
-- ============================================================================
-- CLOSER — door-specialist fields
-- The business sells DOORS. Capture what the client wants (door type + how many)
-- and a signal for whether a follow-up has been sent.
-- ============================================================================

alter table deals add column if not exists door_type text;          -- entry / patio / storm / french / sliding / garage / interior / bifold / screen / other
alter table deals add column if not exists door_count int;          -- how many doors
alter table deals add column if not exists followup_sent_at timestamptz;  -- set when a follow-up email is approved/sent

-- ============================================================
-- supabase/migrations/0006_grants.sql
-- ============================================================
-- ============================================================================
-- CLOSER — role grants
-- Make sure Supabase's API roles can reach the public tables. Row-Level
-- Security still controls WHICH rows each user sees; these grants just allow
-- the roles to touch the tables at all (needed when the schema is created via
-- the Management API rather than the SQL editor).
-- ============================================================================

grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- 0007_inbound.sql
-- ============================================================================
-- CLOSER — inbound webhook token
-- Lets Plaud / Zapier / Make POST a new transcript straight into the app.
-- ============================================================================

alter table settings add column if not exists inbound_token text unique;

-- 0008_followups.sql
-- ============================================================================
-- CLOSER — follow-up counter on the deal (e.g. 1/3 follow-ups done)
-- ============================================================================

alter table deals add column if not exists followups_count int not null default 0;

-- 0009_commission_per_deal.sql
-- ============================================================================
-- CLOSER — manual commission per deal (falls back to ~9% of quote when empty)
-- ============================================================================

alter table deals add column if not exists commission numeric;
