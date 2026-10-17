-- 0011_respondent_badges.sql
--
-- M14 (FR-08, FR-14-ish, PRD §6, §9, §15): the gamified literacy badge.
--
-- The 5\u20136 question literacy quiz writes one row per submission to
-- `respondent_badges`. The respondent is identified only by their
-- platform-issued `respondent_pseudonym`; no name, no email, no
-- respondent_id. The mascot tier is derived from the quiz_score so the
-- presentation never shows a raw 0\u201310 number; the score lives in the
-- row for the auditor / analyst to reason over.
--
-- `team_badges` is the team-level rollup. Each row is the dominant tier
-- across the team's badges at `computed_at`. Teams never show a raw
-- score, only the dominant mascot.
--
-- Privacy (PRD \u00a715):
--  * no respondent name;
--  * quiz answers are stored as a JSONB array of `{question, choice}` so
--    the auditor can audit what was answered; no free-text is captured;
--  * `retention_at` mirrors the tenant's `retention_days` so a future
--    cleanup worker can purge old rows once that lands.

BEGIN;

SET LOCAL app.is_service_account = 'on';

CREATE TABLE respondent_badges (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  respondent_pseudonym    TEXT NOT NULL,
  engagement_id           UUID REFERENCES engagements(id) ON DELETE SET NULL,
  quiz_score              SMALLINT NOT NULL CHECK (quiz_score BETWEEN 1 AND 100),
  mascot_tier             TEXT NOT NULL CHECK (mascot_tier IN ('tortoise', 'fox', 'owl')),
  source_answers          JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- A pseudonym may take the quiz more than once; we keep the latest and
  -- a history row for the analyst. `is_current` flags the row that
  -- counts toward the team rollup; older rows remain queryable.
  is_current              BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  retention_at            TIMESTAMPTZ NOT NULL DEFAULT now() + interval '365 days',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX respondent_badges_tenant_team_idx
  ON respondent_badges (tenant_id, mascot_tier, assigned_at DESC);
CREATE INDEX respondent_badges_pseudonym_idx
  ON respondent_badges (tenant_id, respondent_pseudonym, is_current)
  WHERE is_current = TRUE;
CREATE INDEX respondent_badges_retention_idx
  ON respondent_badges (retention_at)
  WHERE retention_at IS NOT NULL;

ALTER TABLE respondent_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE respondent_badges FORCE ROW LEVEL SECURITY;

CREATE POLICY respondent_badges_select ON respondent_badges FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY respondent_badges_insert ON respondent_badges FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY respondent_badges_update ON respondent_badges FOR UPDATE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
-- Soft transitions only; hard deletes reserved for the cleanup worker.
CREATE POLICY respondent_badges_delete ON respondent_badges FOR DELETE
  USING (app_is_service_account());

GRANT SELECT, INSERT, UPDATE, DELETE ON respondent_badges TO auditai_app;

-- ---------------------------------------------------------------------------

CREATE TABLE team_badges (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  team_id                 UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  -- The dominant tier is the modal mascot across the team's `is_current`
  -- badges. Tied tiers resolve alphabetically (fox > owl > tortoise).
  dominant_tier           TEXT NOT NULL CHECK (dominant_tier IN ('tortoise', 'fox', 'owl')),
  member_count            INTEGER NOT NULL CHECK (member_count >= 0),
  tortoise_count          INTEGER NOT NULL CHECK (tortoise_count >= 0),
  fox_count               INTEGER NOT NULL CHECK (fox_count >= 0),
  owl_count               INTEGER NOT NULL CHECK (owl_count >= 0),
  computed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id)
);

CREATE INDEX team_badges_tenant_tier_idx
  ON team_badges (tenant_id, dominant_tier, computed_at DESC);

ALTER TABLE team_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_badges FORCE ROW LEVEL SECURITY;

CREATE POLICY team_badges_select ON team_badges FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY team_badges_insert ON team_badges FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY team_badges_update ON team_badges FOR UPDATE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY team_badges_delete ON team_badges FOR DELETE
  USING (app_is_service_account());

GRANT SELECT, INSERT, UPDATE, DELETE ON team_badges TO auditai_app;

COMMIT;
