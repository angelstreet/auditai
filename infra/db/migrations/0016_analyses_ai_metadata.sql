-- 0016_analyses_ai_metadata.sql
--
-- Model-backed synthesis (TASK-H, PRD §10, ADR 0029). Forward-only: adds the provenance and
-- cost columns PRD §10 asks to store with every analysis, and a per-tenant list of names to
-- redact before any model call.
--
-- Existing rule-based rows keep the defaults (no provider call, zero tokens, zero cost).

BEGIN;

SET LOCAL app.is_service_account = 'on';

ALTER TABLE analyses
  ADD COLUMN model_provider      text,
  ADD COLUMN model_name          text,
  ADD COLUMN model_version       text,
  ADD COLUMN model_region        text,
  ADD COLUMN prompt_version      text,
  ADD COLUMN input_record_ids    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN unsupported_json    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN input_tokens        integer     NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  ADD COLUMN output_tokens       integer     NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  ADD COLUMN cost_amount         numeric(14, 6) NOT NULL DEFAULT 0 CHECK (cost_amount >= 0),
  ADD COLUMN cost_currency       text,
  ADD COLUMN rate_effective_from timestamp with time zone,
  ADD COLUMN generated_at        timestamp with time zone,
  ADD COLUMN duration_ms         integer;

-- Monthly spend per tenant is summed over this index for the cost ceiling.
CREATE INDEX analyses_tenant_generated_idx
  ON analyses (tenant_id, generated_at)
  WHERE generated_at IS NOT NULL;

CREATE TABLE ai_redaction_terms (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  term        text        NOT NULL CHECK (length(btrim(term)) >= 2),
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, term)
);

ALTER TABLE ai_redaction_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_redaction_terms FORCE ROW LEVEL SECURITY;

CREATE POLICY ai_redaction_terms_select ON ai_redaction_terms FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY ai_redaction_terms_insert ON ai_redaction_terms FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY ai_redaction_terms_update ON ai_redaction_terms FOR UPDATE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY ai_redaction_terms_delete ON ai_redaction_terms FOR DELETE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_redaction_terms TO auditai_app;

COMMIT;
