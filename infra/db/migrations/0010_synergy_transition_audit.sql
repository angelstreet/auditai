-- 0010_synergy_transition_audit.sql
--
-- M13 slice C (FR-14, PRD §10): the cross-team synergy admin surface.
--
-- Extends the `audit_log.action` CHECK to record the three human-triggered
-- transitions on a synergy row: surface / dismiss / archive. The worker
-- already writes `synergy.detect` rows (see migration 0009).
--
-- Forward-only ALTER; no data rewrite.

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
      'synergy.archive'
    ));

COMMIT;
