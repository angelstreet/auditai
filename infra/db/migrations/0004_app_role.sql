-- 0004_app_role.sql
--
-- Create the non-superuser application role. The bootstrap user created by `initdb -U` is a
-- superuser and therefore bypasses row-level security even with `FORCE ROW LEVEL SECURITY`
-- (PostgreSQL: "Superusers and roles with the BYPASSRLS attribute always bypass the row
-- security system"). Tests and runtime services connect as `auditai_app`, never as the bootstrap
-- user, so RLS is genuinely enforced.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auditai_app') THEN
    CREATE ROLE auditai_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO auditai_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO auditai_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO auditai_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO auditai_app;

COMMIT;