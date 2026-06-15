-- ============================================================================
-- CLOSER — automations + widget (Phase 5)
-- ============================================================================

-- Flag set by the daily automation when a deal goes quiet (SPEC.md Phase 5).
alter table deals add column if not exists at_risk boolean not null default false;

-- Read-only token for the home-screen widget endpoint (/api/widget?token=...).
alter table settings add column if not exists widget_token text unique;
