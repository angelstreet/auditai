-- 0018_invitations_tracking.sql
--
-- TASK-N (FR-03, PRD §15, §25.1, ADR 0033): bulk invitations, response tracking, reminders.
--
--  * `invitations` gains day-granular activity and reminder bookkeeping. No name, no email and no
--    free text is added to it: default mode stores no personal data at all.
--  * `invitation_deliveries` exists only for engagements that switch email delivery on. It holds
--    the address encrypted with an app key, only while it is needed to deliver and to remind, and is
--    purged on completion, revocation, expiry and by the retention worker. Service-account only.
--  * New audit actions for the admin operations (the trail stores counts, never addresses or links).

BEGIN;

SET LOCAL app.is_service_account = 'on';

ALTER TABLE invitations
  ADD COLUMN last_activity_on DATE,
  ADD COLUMN revoked_at       TIMESTAMPTZ,
  ADD COLUMN reminder_count   INTEGER NOT NULL DEFAULT 0 CHECK (reminder_count BETWEEN 0 AND 10),
  ADD COLUMN last_reminder_on DATE,
  ADD COLUMN created_by       UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX invitations_token_reference_idx ON invitations (token_reference);
CREATE INDEX invitations_engagement_team_idx ON invitations (engagement_id, team_id);

CREATE TABLE invitation_deliveries (
  invitation_id    UUID PRIMARY KEY REFERENCES invitations(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- AES-256-GCM, base64url(iv || tag || ciphertext). The key is INVITE_EMAIL_KEY, never in the repo.
  address_cipher   TEXT NOT NULL,
  purge_after      TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX invitation_deliveries_tenant_idx ON invitation_deliveries (tenant_id);
CREATE INDEX invitation_deliveries_purge_idx ON invitation_deliveries (purge_after);

ALTER TABLE invitation_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_deliveries FORCE ROW LEVEL SECURITY;
-- Only server code acting as the service account reads or writes addresses; a tenant-scoped
-- session (the respondent flow, an exported report) can never see this table.
CREATE POLICY invitation_deliveries_service ON invitation_deliveries FOR ALL
  USING (app_is_service_account()) WITH CHECK (app_is_service_account());

GRANT SELECT, INSERT, UPDATE, DELETE ON invitation_deliveries TO auditai_app;

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
      'invitation.purge_addresses', 'invitation.settings'
    ));

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_target_kind_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_kind_check CHECK (target_kind IN (
      'analysis', 'opportunity', 'synergy', 'respondent_badge', 'export_request', 'invitation',
      'user', 'engagement'
    ));

COMMIT;
