-- 0021_audit_setup.sql
--
-- TASK-T (ADR 0038): the auditor sets an audit up in the admin.
--
-- * engagements.name: the auditor's own label for an engagement ("Spring 2027 audit"). Nullable, so
--   existing rows keep showing the organisation name.
-- * invitations.batch_id: groups the links created together, so a whole batch can be revoked and a
--   second identical batch can be flagged as a likely double click. Nullable for older rows.
-- * Audit verbs for engagement and team set-up, and the `team` target kind.
--
-- Forward only. The RLS policies of engagements, teams and invitations already cover these writes.

BEGIN;

SET LOCAL app.is_service_account = 'on';

ALTER TABLE engagements ADD COLUMN IF NOT EXISTS name TEXT
  CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 120);

ALTER TABLE invitations ADD COLUMN IF NOT EXISTS batch_id UUID;
CREATE INDEX IF NOT EXISTS invitations_batch_idx ON invitations (tenant_id, batch_id)
  WHERE batch_id IS NOT NULL;

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
      'team.create', 'team.update', 'invitation.revoke_batch'
    ));

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_target_kind_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_kind_check CHECK (target_kind IN (
      'analysis', 'opportunity', 'synergy', 'respondent_badge', 'export_request',
      'invitation', 'user', 'engagement', 'redaction_term', 'team'
    ));

COMMIT;
