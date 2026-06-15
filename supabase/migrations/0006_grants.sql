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
