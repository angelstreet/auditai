-- 0008_synergies.sql
--
-- M13 (FR-14, PRD §10): cross-team synergy detection.
--
-- The detection worker (next M13 slice) groups approved-analyses themes by
-- `(axis, lower(themeLabel))` and writes one row per group that crosses at
-- least two engagements within a single tenant. The row carries a stable
-- `synergy_key` so a re-run is idempotent; `source_engagement_ids` is a
-- jsonb array of engagement UUIDs derived from `source_analysis_ids`.
--
-- Privacy: the synergy stores only ids + a short follow-up prompt; no
-- answers, no respondent pseudonyms. The `audit_log` row written at
-- detection time (action `synergy.detect`) carries the worker actor and
-- the `targetKind = 'synergy'` reference per ADR 0011.

BEGIN;

SET LOCAL app.is_service_account = 'on';

CREATE TABLE synergies (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  axis                      TEXT NOT NULL
                            CHECK (axis IN ('literacy', 'practice', 'organisational_readiness')),
  theme_label               TEXT NOT NULL,
  -- Stable hash of (axis | lower(themeLabel)). Re-running the worker is idempotent on this key.
  synergy_key               TEXT NOT NULL,
  -- Distinct approved-analysis ids that contributed to this theme. >= 2 by construction.
  source_analysis_ids       JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Derived from source_analysis_ids at write time. >= 2 by construction.
  source_engagement_ids     JSONB NOT NULL DEFAULT '[]'::jsonb,
  occurrence_count          INTEGER NOT NULL CHECK (occurrence_count >= 2),
  proposed_followup_prompt  TEXT NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'detected'
                            CHECK (status IN ('detected', 'surfaced', 'dismissed', 'archived')),
  detected_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  surfaced_at               TIMESTAMPTZ,
  dismissed_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotent inserts: same tenant + same key never produces a second row.
  UNIQUE (tenant_id, synergy_key)
);

CREATE INDEX synergies_tenant_axis_idx
  ON synergies (tenant_id, axis, status, detected_at DESC);

CREATE INDEX synergies_status_idx
  ON synergies (status)
  WHERE status = 'detected';

ALTER TABLE synergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE synergies FORCE ROW LEVEL SECURITY;

CREATE POLICY synergies_select ON synergies FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY synergies_insert ON synergies FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY synergies_update ON synergies FOR UPDATE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
-- Soft transitions are the right model for synergies; no hard delete.
CREATE POLICY synergies_delete ON synergies FOR DELETE
  USING (app_is_service_account());

GRANT SELECT, INSERT, UPDATE, DELETE ON synergies TO auditai_app;

COMMIT;
