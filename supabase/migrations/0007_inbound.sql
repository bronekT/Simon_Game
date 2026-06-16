-- ============================================================================
-- CLOSER — inbound webhook token
-- Lets Plaud / Zapier / Make POST a new transcript straight into the app.
-- ============================================================================

alter table settings add column if not exists inbound_token text unique;
