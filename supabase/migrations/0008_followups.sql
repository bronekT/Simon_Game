-- ============================================================================
-- CLOSER — follow-up counter on the deal (e.g. 1/3 follow-ups done)
-- ============================================================================

alter table deals add column if not exists followups_count int not null default 0;
