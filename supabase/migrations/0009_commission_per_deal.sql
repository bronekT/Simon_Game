-- ============================================================================
-- CLOSER — manual commission per deal (falls back to ~9% of quote when empty)
-- ============================================================================

alter table deals add column if not exists commission numeric;
