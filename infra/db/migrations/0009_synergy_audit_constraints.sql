-- 0009_synergy_audit_constraints.sql
--
-- M13 slice B (FR-14, PRD §10): the cross-team synergy worker.
--
-- This migration extends the audit_log CHECK constraints (added in 0006)
-- so the new `synergy.detect` action and the new `synergy` target kind are
-- accepted. The worker in `services/ai/src/synergyDetector.ts` writes one
-- audit_log row per detected recurrence.
--
-- The `synergies` table itself was added in 0008; this migration only
-- opens up the audit trail.

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
      'synergy.detect'
    ));

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_target_kind_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_kind_check CHECK (target_kind IN ('analysis','opportunity','synergy'));

COMMIT;
