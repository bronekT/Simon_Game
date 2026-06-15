-- ============================================================================
-- CLOSER — door-specialist fields
-- The business sells DOORS. Capture what the client wants (door type + how many)
-- and a signal for whether a follow-up has been sent.
-- ============================================================================

alter table deals add column if not exists door_type text;          -- entry / patio / storm / french / sliding / garage / interior / bifold / screen / other
alter table deals add column if not exists door_count int;          -- how many doors
alter table deals add column if not exists followup_sent_at timestamptz;  -- set when a follow-up email is approved/sent
