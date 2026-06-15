-- ============================================================================
-- CLOSER — commission tracking (UI improvement)
-- Lets you mark a won deal's commission as actually received ("realized").
-- ============================================================================

alter table deals add column if not exists commission_paid boolean not null default false;
