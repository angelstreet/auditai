-- 0024_audit_verbs_resync.sql
--
-- TASK-V: 0022 (TASK-U) and 0023 (TASK-V) were written in parallel and both rebuild the audit_log
-- CHECK constraints. On a fresh database they run in order and 0023 already holds the union. On a
-- database where 0023 was applied before 0022, 0022 would have dropped the report verbs. This
-- re-asserts the union after both, so the result no longer depends on the order. Idempotent,
-- forward only.

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
      'redaction_term.add', 'redaction_term.remove',
      'engagement.create', 'engagement.update', 'engagement.launch', 'engagement.close',
      'team.create', 'team.update', 'invitation.revoke_batch',
      'referent.invite', 'password.set', 'password.reset_request', 'password.reset',
      'privacy.update', 'privacy_request.create', 'privacy_request.handle',
      'report.create', 'report.update', 'report.suggest', 'report.plan',
      'report.submit', 'report.publish', 'report.unpublish', 'report.new_version',
      'report.ai_draft', 'report.export',
      'report_step.add', 'report_step.update', 'report_step.accept', 'report_step.reject'
    ));

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_target_kind_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_kind_check CHECK (target_kind IN (
      'analysis', 'opportunity', 'synergy', 'respondent_badge', 'export_request',
      'invitation', 'user', 'engagement', 'redaction_term', 'team', 'privacy_request',
      'report', 'report_step'
    ));

COMMIT;
