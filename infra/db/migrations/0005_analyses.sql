-- 0005_analyses.sql
--
-- AI pipeline output (M9, PRD \u00a710). The worker in `services/ai` reads `submissions`
-- joined with `answers` and `question_items`, runs the sensitivity / theme /
-- contradiction / interview-prompt pipeline, and writes the result here.
--
-- One row per submission. The `payload_json` column is the schema-validated
-- output of the AI worker; we store it as `jsonb` so the worker can evolve the
-- shape without further migrations. The `sensitivity`, `theme_count` and
-- `prompt_count` columns are denormalised counters so the auditor UI can
-- filter / sort without unpacking the full payload.
--
-- `evidence_json` is an array of `{claim, sourceKind, sourceId, quote}`
-- records \u2014 every claim must link back to a source row in the
-- application (PRD \u00a710, FR-12, ADR 0007).

BEGIN;

SET LOCAL app.is_service_account = 'on';

CREATE TABLE analyses (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engagement_id   uuid        NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  submission_id   uuid        NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  version         integer     NOT NULL DEFAULT 1,
  sensitivity     text        NOT NULL CHECK (sensitivity IN ('public', 'internal', 'sensitive')),
  theme_count     integer     NOT NULL DEFAULT 0,
  prompt_count    integer     NOT NULL DEFAULT 0,
  payload_json    jsonb       NOT NULL,
  evidence_json   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  model_route     text        NOT NULL,
  approved_at     timestamp with time zone,
  approved_by     uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  updated_at      timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (submission_id, version)
);

CREATE INDEX analyses_tenant_engagement_idx
  ON analyses (tenant_id, engagement_id, created_at DESC);

CREATE INDEX analyses_sensitivity_idx
  ON analyses (sensitivity, created_at DESC)
  WHERE approved_at IS NULL;

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses FORCE ROW LEVEL SECURITY;

CREATE POLICY analyses_select ON analyses FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY analyses_insert ON analyses FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY analyses_update ON analyses FOR UPDATE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY analyses_delete ON analyses FOR DELETE
  USING (app_is_service_account());

-- Re-seed the auditai_app role grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON analyses TO auditai_app;

COMMIT;
