-- ============================================================================
-- CLOSER — commission payment stages (0 = unpaid, 1 = 1st 50%, 2 = paid in full)
-- ============================================================================

alter table deals add column if not exists payment_stage int not null default 0;
