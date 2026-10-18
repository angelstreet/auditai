-- 0020_redaction_terms_audit.sql
--
-- TASK-Q (Gate B, PRD §10, ADR 0029, ADR 0035): audit trail for the per-tenant
-- redaction-term admin UI.
--
-- The `ai_redaction_terms` table exists from migration 0016 (TASK-H) with
-- the four-policy RLS pattern, but adding or removing a term through the
-- admin shell must write to `audit_log` so the trail records who changed
-- the redaction list and when.
--
-- * New action verbs: `redaction_term.add`, `redaction_term.remove`.
-- * New target_kind: `redaction_term` (the row id is the `ai_redaction_terms.id`).
-- * The RLS on `audit_log` is unchanged: tenant-scoped reads, service-account
--   fallback for the worker. Append-only enforcement is already from 0006.
--
-- The `ai_redaction_terms` policy set already supports all four verbs from
-- the admin shell (the table has the standard SELECT / INSERT / UPDATE /
-- DELETE policies). We only extend the audit-log CHECKs here.

BEGIN;

SET LOCAL app.is_service_account = 'on';

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
      'redaction_term.add', 'redaction_term.remove'
    ));

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_target_kind_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_kind_check CHECK (target_kind IN (
      'analysis', 'opportunity', 'synergy', 'respondent_badge', 'export_request',
      'invitation', 'user', 'engagement', 'redaction_term'
    ));

COMMIT;