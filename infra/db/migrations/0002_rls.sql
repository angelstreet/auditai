-- 0002_rls.sql
--
-- Row-level security for every tenant-scoped table (PRD \u00a715, \u00a725.1, \u00a733).
--
-- Conventions:
--   * The application sets `SET LOCAL app.tenant_id = '...'` at the start of every transaction.
--   * Policies compare `tenant_id = current_setting('app.tenant_id')::uuid` for SELECT/DELETE/UPDATE.
--   * INSERT must include `tenant_id = current_setting('app.tenant_id')::uuid` in WITH CHECK.
--   * The `tenants` table itself is RLS-gated with a separate policy: only `app.tenant_id` may
--     SELECT/UPDATE its own row; an explicit `app.is_service_account` flag bypasses admin tasks.
--   * `users` is intentionally *not* tenant-scoped (one human can belong to many tenants) but
--     INSERT/UPDATE requires `app.is_service_account`; ordinary API calls hit users via a join
--     to a tenant-scoped table.
--
-- The cross-tenant deny test (tests/db/isolation.test.ts) verifies these policies.

BEGIN;

-- Helper: read the current tenant id safely. If unset, no tenant filter applies \u2014 that is the
-- *intended* fail-closed behaviour for any code path that forgot to set the variable.
CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS UUID
LANGUAGE plpgsql STABLE AS $$
DECLARE
  raw TEXT;
BEGIN
  raw := current_setting('app.tenant_id', true);
  IF raw IS NULL OR raw = '' THEN
    RETURN NULL;
  END IF;
  RETURN raw::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION app_is_service_account() RETURNS BOOLEAN
LANGUAGE plpgsql STABLE AS $$
DECLARE
  raw TEXT;
BEGIN
  raw := current_setting('app.is_service_account', true);
  RETURN raw = 'on' OR raw = 'true';
END;
$$;

-- ---------------------------------------------------------------------------
-- tenants \u2014 self-only with service-account bypass
-- ---------------------------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_self_select ON tenants;
CREATE POLICY tenants_self_select ON tenants FOR SELECT
  USING (
    app_is_service_account() OR id = app_current_tenant_id()
  );

DROP POLICY IF EXISTS tenants_self_modify ON tenants;
CREATE POLICY tenants_self_modify ON tenants FOR UPDATE
  USING (app_is_service_account() OR id = app_current_tenant_id())
  WITH CHECK (app_is_service_account() OR id = app_current_tenant_id());

DROP POLICY IF EXISTS tenants_service_insert ON tenants;
CREATE POLICY tenants_service_insert ON tenants FOR INSERT
  WITH CHECK (app_is_service_account());

DROP POLICY IF EXISTS tenants_service_delete ON tenants;
CREATE POLICY tenants_service_delete ON tenants FOR DELETE
  USING (app_is_service_account());

-- ---------------------------------------------------------------------------
-- Generic tenant-scoped policies
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'organisations',
    'departments',
    'teams',
    'memberships',
    'templates',
    'question_items',
    'questionnaire_versions',
    'engagements',
    'engagement_teams',
    'invitations',
    'respondents',
    'submissions',
    'answers'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I_select ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select ON %I FOR SELECT USING (app_is_service_account() OR tenant_id = app_current_tenant_id())',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_insert ON %I FOR INSERT WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id())',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_update ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_update ON %I FOR UPDATE USING (app_is_service_account() OR tenant_id = app_current_tenant_id()) WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id())',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_delete ON %I FOR DELETE USING (app_is_service_account() OR tenant_id = app_current_tenant_id())',
      t, t
    );
  END LOOP;
END
$$;

-- users are global but only writable by service accounts. Reads are unrestricted because
-- membership rows reference them.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS users_service_write ON users;
CREATE POLICY users_service_write ON users FOR ALL
  USING (app_is_service_account())
  WITH CHECK (app_is_service_account());

COMMIT;