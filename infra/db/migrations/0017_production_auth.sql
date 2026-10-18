-- 0017_production_auth.sql
--
-- TASK-K (ADR 0032): production readiness for the auditor sign-in.
--
--   * Clears the password hashes migration 0015 seeded for the two synthetic auditors. Their
--     passwords are written in this public repo, so no deployed database may keep them. The
--     local runner, smokes and Playwright re-apply the hashes after migrations with
--     infra/db/scripts/seed-synthetic-auth.mjs, which refuses to run when NODE_ENV=production.
--   * `users.disabled_at`: a disabled user cannot sign in (auditor:disable).
--   * `login_attempts`: the Postgres-backed rate limit / lockout of /api/auth/login. Keys are
--     SHA-256 digests (e-mail or client address), never raw values.
--   * audit_log: new verbs and target kind for user management by the CLI.

BEGIN;

SET LOCAL app.is_service_account = 'on';

UPDATE users SET password_hash = NULL
 WHERE id IN ('99999999-9999-4999-8999-999999999999', '99999999-9999-4999-8999-aaaaaaaaaaaa');

ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

CREATE TABLE login_attempts (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope        TEXT NOT NULL CHECK (scope IN ('email', 'ip')),
  key_hash     TEXT NOT NULL,
  succeeded    BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_lookup_idx ON login_attempts (scope, key_hash, attempted_at DESC);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY login_attempts_service ON login_attempts FOR ALL
  USING (app_is_service_account()) WITH CHECK (app_is_service_account());

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_action_check CHECK (action IN (
      'analysis.approve', 'analysis.reject',
      'opportunity.create', 'opportunity.update', 'opportunity.archive',
      'synergy.detect', 'synergy.surface', 'synergy.dismiss', 'synergy.archive',
      'export.complete', 'badge.erase', 'pseudonym.erase',
      'user.create', 'user.set_password', 'user.disable'
    ));

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_target_kind_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_kind_check CHECK (target_kind IN (
      'analysis', 'opportunity', 'synergy', 'respondent_badge', 'export_request', 'invitation',
      'user'
    ));

COMMIT;
