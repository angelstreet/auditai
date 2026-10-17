-- 0007_sponsor_briefs.sql
--
-- M12 (FR-08, PRD §4, §9, §15, §25.1): the sponsor intake.
--
-- The animated welcome + sponsor intake flow at `/welcome` and `/intake`
-- writes one row per submission. The form is multi-step (requirements,
-- budget, security, AI maturity) and is the front door to every new
-- engagement. The client-facing portfolio board at `/board` reads the
-- same table to display the engagement's maturity envelope alongside the
-- status pills.
--
-- Privacy: the table is tenant-scoped and RLS-gated. We never store
-- client names, real employee names, or anything outside the brief. The
-- `maturity_self_assessment` column carries the three-axis self-rating the
-- sponsor reports; the calibrated score is computed by the audit, not by
-- the sponsor.

BEGIN;

SET LOCAL app.is_service_account = 'on';

CREATE TABLE sponsor_briefs (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- The sponsor who filled out the form. Nullable so a draft can exist
  -- before the sponsor membership is wired up (M12 ships without SSO).
  sponsor_user_id             UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Free-text "what does leadership want AI to improve first" answer.
  top_priority_workflow       TEXT NOT NULL DEFAULT '',
  -- Selected departments, stored as a jsonb array of strings.
  departments_in_scope        JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Selected sensitivity boundary, also a jsonb array.
  data_sensitivity_boundary   JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Budget envelope (€ per year). Nullable so the sponsor can skip the
  -- optional question.
  annual_budget_eur           NUMERIC(12,2)
                              CHECK (annual_budget_eur IS NULL OR annual_budget_eur >= 0),
  -- Selected appetite: 'full_pilot' | 'limited_team' | 'remote_only'.
  onsite_appetite             TEXT
                              CHECK (onsite_appetite IS NULL OR onsite_appetite IN
                                    ('full_pilot', 'limited_team', 'remote_only')),

  -- Approved model regions: jsonb array of strings.
  approved_model_regions      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Data residency location: jsonb array.
  data_residency              JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Prompt-injection review: 'external_auditor' | 'internal' | 'none_yet'.
  prompt_injection_review     TEXT
                              CHECK (prompt_injection_review IS NULL OR prompt_injection_review IN
                                    ('external_auditor', 'internal', 'none_yet')),

  -- The sponsor's self-assessment on the three maturity axes, 0..5.
  leadership_literacy         INTEGER
                              CHECK (leadership_literacy IS NULL OR leadership_literacy BETWEEN 0 AND 5),
  operational_adoption        INTEGER
                              CHECK (operational_adoption IS NULL OR operational_adoption BETWEEN 0 AND 5),
  policy_governance           INTEGER
                              CHECK (policy_governance IS NULL OR policy_governance BETWEEN 0 AND 5),

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sponsor_briefs_tenant_created_idx
  ON sponsor_briefs (tenant_id, created_at DESC);

ALTER TABLE sponsor_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_briefs FORCE ROW LEVEL SECURITY;

CREATE POLICY sponsor_briefs_select ON sponsor_briefs FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY sponsor_briefs_insert ON sponsor_briefs FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY sponsor_briefs_update ON sponsor_briefs FOR UPDATE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
-- Soft delete is the right pattern for a sponsor brief; the table does not
-- expose a hard delete.
CREATE POLICY sponsor_briefs_delete ON sponsor_briefs FOR DELETE
  USING (app_is_service_account());

GRANT SELECT, INSERT, UPDATE, DELETE ON sponsor_briefs TO auditai_app;

COMMIT;
