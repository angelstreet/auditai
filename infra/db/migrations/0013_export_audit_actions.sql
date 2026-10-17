-- 0013_export_audit_actions.sql
--
-- M15 (FR-09, PRD §25.4): extend audit_log action CHECK to accept the
-- new verbs the right-to-erasure + retention worker write:
--   * `export.complete`  \u2014 an analyst run finished a CSV export
--   * `badge.erase`       \u2014 the tenant admin (or the retention worker)
--                          removed one or more respondent_badges
--
-- Forward-only ALTER.

BEGIN;

SET LOCAL app.is_service_account = 'on';

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_action_check CHECK (action IN (
      'analysis.approve',
      'analysis.reject',
      'opportunity.create',
      'opportunity.update',
      'opportunity.archive',
      'synergy.detect',
      'synergy.surface',
      'synergy.dismiss',
      'synergy.archive',
      'export.complete',
      'badge.erase'
    ));

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_target_kind_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_kind_check CHECK (target_kind IN (
      'analysis',
      'opportunity',
      'synergy',
      'respondent_badge',
      'export_request'
    ));

COMMIT;
