-- 0022_referent_login_privacy_requests.sql
--
-- TASK-U (ADR 0039): real login for a referent, privacy requests, wider audit trail.
--
-- * auth_tokens: single-use, expiring set-password / reset tokens. Only the SHA-256 of the token is
--   stored, never the token. Service account only (the public pages run as the service account and
--   check the token themselves).
-- * public_attempts: rate-limit counters for public forms (forgot password, privacy request). Keys
--   are digests; no address or IP is stored.
-- * privacy_requests: a person asks, without going through a manager, to withdraw or erase. Tenant
--   scoped; the auditor sees them on the data page. No name is collected.
-- * Audit verbs and target kind for the above.
--
-- Forward only. Nothing here touches existing rows.

BEGIN;

SET LOCAL app.is_service_account = 'on';

CREATE TABLE auth_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('invite', 'reset')),
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_user_idx ON auth_tokens (user_id, kind, created_at DESC);

ALTER TABLE auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY auth_tokens_service ON auth_tokens FOR ALL
  USING (app_is_service_account()) WITH CHECK (app_is_service_account());

CREATE TABLE public_attempts (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('forgot_password', 'privacy_request')),
  scope        TEXT NOT NULL CHECK (scope IN ('email', 'ip')),
  key_hash     TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX public_attempts_lookup_idx ON public_attempts (kind, scope, key_hash, attempted_at DESC);

ALTER TABLE public_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY public_attempts_service ON public_attempts FOR ALL
  USING (app_is_service_account()) WITH CHECK (app_is_service_account());

CREATE TABLE privacy_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engagement_id  UUID REFERENCES engagements(id) ON DELETE SET NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('withdraw', 'erase', 'question')),
  -- The respondent code the person holds, if they typed it. Free text, bounded; never a name.
  respondent_code TEXT CHECK (respondent_code IS NULL OR char_length(respondent_code) <= 64),
  message        TEXT CHECK (message IS NULL OR char_length(message) <= 1000),
  -- Optional way to answer. Kept only until the request is handled, then cleared.
  reply_to       TEXT CHECK (reply_to IS NULL OR char_length(reply_to) <= 320),
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'handled')),
  handled_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX privacy_requests_tenant_idx ON privacy_requests (tenant_id, status, created_at DESC);

ALTER TABLE privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY privacy_requests_select ON privacy_requests FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY privacy_requests_insert ON privacy_requests FOR INSERT
  WITH CHECK (app_is_service_account());
CREATE POLICY privacy_requests_update ON privacy_requests FOR UPDATE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON auth_tokens, public_attempts, privacy_requests TO auditai_app;

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_action_check CHECK (action IN (
      'analysis.approve', 'analysis.reject',
      'opportunity.create', 'opportunity.update', 'opportunity.archive',
      'synergy.detect', 'synergy.surface', 'synergy.dismiss', 'synergy.archive',
      'export.complete', 'badge.erase', 'pseudonym.erase',
      'user.create', 'user.set_password', 'user.disable',
      'invitation.create_batch', 'invitation.export', 'invitation.revoke',
      'invitation.extend', 'invitation.regenerate', 'invitation.remind',
      'invitation.purge_addresses', 'invitation.settings',
      'view_as.start', 'view_as.stop', 'view_as.request', 'view_as.refused',
      'client.seed', 'user.set_email',
      'redaction_term.add', 'redaction_term.remove',
      'engagement.create', 'engagement.update', 'engagement.launch', 'engagement.close',
      'team.create', 'team.update', 'invitation.revoke_batch',
      'referent.invite', 'password.set', 'password.reset_request', 'password.reset',
      'privacy.update', 'privacy_request.create', 'privacy_request.handle'
    ));

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_target_kind_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_kind_check CHECK (target_kind IN (
      'analysis', 'opportunity', 'synergy', 'respondent_badge', 'export_request',
      'invitation', 'user', 'engagement', 'redaction_term', 'team', 'privacy_request'
    ));

COMMIT;
