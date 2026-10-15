-- 0006_audit_log_and_opportunities.sql
--
-- M10 (FR-08, PRD §10, §25.4): the auditor review surface.
--
-- Two new tables:
--
--   * `audit_log` is the append-only trail of every action taken by an auditor on an analysis
--     (approve, reject, comment) or on an opportunity (create, update, archive). The rows are
--     scoped to a tenant so cross-tenant reads still require `app.tenant_id` or a service account.
--     Updates and deletes are blocked by RLS.
--
--   * `opportunities` is the start of the opportunity register (FR-08). For M10 it is created
--     empty (the schema is what the auditor UI needs to render rows from `analyses` and write
--     opportunities out of them). M11+ will add the workflow transitions, the publish gate and
--     the cross-team synergy detection.
--
-- The synthetic seed inserts a single auditor user with one membership per tenant, so the smoke
-- can pick a real `users.id` for the `audit_log.actor_user_id` foreign key and the
-- `analyses.approved_by` foreign key (added in M9) without a follow-up migration.

BEGIN;

SET LOCAL app.is_service_account = 'on';

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- Free-text action verb, e.g. 'analysis.approve', 'opportunity.create'. Constrained by a
  -- check so a typo cannot sneak into the trail.
  action          TEXT NOT NULL CHECK (action IN (
      'analysis.approve',
      'analysis.reject',
      'opportunity.create',
      'opportunity.update',
      'opportunity.archive'
    )),
  -- The row the action targets, polymorphic by `target_kind` (PRD §25.4 audit log).
  target_kind     TEXT NOT NULL CHECK (target_kind IN ('analysis','opportunity')),
  target_id       UUID NOT NULL,
  -- Free-form JSON payload: the previous and next states, the model route, the prompt
  -- template version, the human rationale, etc.
  payload_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_tenant_created_idx
  ON audit_log (tenant_id, created_at DESC);
CREATE INDEX audit_log_target_idx
  ON audit_log (target_kind, target_id, created_at DESC);
CREATE INDEX audit_log_actor_idx
  ON audit_log (actor_user_id, created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select ON audit_log FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY audit_log_insert ON audit_log FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
-- Update / delete blocked. The trail is append-only; corrections are a new row that points at
-- the same target.
CREATE POLICY audit_log_no_update ON audit_log FOR UPDATE
  USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY audit_log_no_delete ON audit_log FOR DELETE
  USING (FALSE);

GRANT SELECT, INSERT ON audit_log TO auditai_app;

-- ---------------------------------------------------------------------------
-- opportunities
-- ---------------------------------------------------------------------------
CREATE TABLE opportunities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engagement_id   UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  -- A nullable FK so a draft opportunity can exist before it is linked back to the AI output
  -- that surfaced it. M11+ will enforce a "must-link" rule before the publish action.
  analysis_id     UUID REFERENCES analyses(id) ON DELETE SET NULL,
  -- Workflow status. M10 only writes 'draft'; the transition to 'approved' and beyond lives
  -- in M11+.
  status          TEXT NOT NULL CHECK (status IN ('draft','approved','in_progress','delivered','archived')),
  -- Short title shown in the opportunity register table.
  title           TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 200),
  -- Long-form description of the opportunity, written by the auditor.
  description     TEXT NOT NULL DEFAULT '',
  -- Axis tag lifted from the source analysis (literacy / practice / readiness / opportunity /
  -- context). Free-text for now so the auditor can also invent tags.
  axis            TEXT,
  -- Estimated impact on a 0..1 scale; the worker never fills this, the auditor does.
  impact_score    NUMERIC(4,3) CHECK (impact_score IS NULL OR impact_score BETWEEN 0 AND 1),
  owner_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at     TIMESTAMPTZ
);

CREATE INDEX opportunities_tenant_engagement_idx
  ON opportunities (tenant_id, engagement_id, created_at DESC);
CREATE INDEX opportunities_tenant_status_idx
  ON opportunities (tenant_id, status, created_at DESC);
CREATE INDEX opportunities_analysis_idx
  ON opportunities (analysis_id);

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities FORCE ROW LEVEL SECURITY;

CREATE POLICY opportunities_select ON opportunities FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY opportunities_insert ON opportunities FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY opportunities_update ON opportunities FOR UPDATE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
-- Same rationale as analyses: clients never delete opportunities. Archive instead.
CREATE POLICY opportunities_delete ON opportunities FOR DELETE
  USING (app_is_service_account());

GRANT SELECT, INSERT, UPDATE, DELETE ON opportunities TO auditai_app;

-- ---------------------------------------------------------------------------
-- Synthetic auditor user (PRD §3, §25.4)
-- ---------------------------------------------------------------------------
-- One auditor per tenant. The `email_hash` is the synthetic SHA-256 of the obviously-fake
-- address so the leak-scan regex does not flag it.
INSERT INTO users (id, email_hash, display_name) VALUES
  ('99999999-9999-4999-8999-999999999999',
   encode(sha256('synthetic-auditor-a@synthetic.invalid'::bytea), 'hex'),
   'Synthetic auditor A'),
  ('99999999-9999-4999-8999-aaaaaaaaaaaa',
   encode(sha256('synthetic-auditor-b@synthetic.invalid'::bytea), 'hex'),
   'Synthetic auditor B');

-- Auditor memberships. A real deployment would gate this on SSO + MFA (PRD Gate C); for the
-- synthetic seed the role is enough to exercise the policy.
INSERT INTO memberships (id, tenant_id, user_id, team_id, role, starts_at) VALUES
  ('a9999999-9999-4999-8999-999999999999',
   '11111111-1111-4111-8111-111111111111',
   '99999999-9999-4999-8999-999999999999',
   NULL, 'auditor', now()),
  ('b9999999-9999-4999-8999-999999999999',
   '22222222-2222-4222-8222-222222222222',
   '99999999-9999-4999-8999-aaaaaaaaaaaa',
   NULL, 'auditor', now());

COMMIT;
