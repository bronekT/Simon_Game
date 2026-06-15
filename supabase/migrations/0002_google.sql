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
