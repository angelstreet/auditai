-- 0023_audit_reports.sql
--
-- TASK-V (ADR 0041): the audit report the client receives, its improvement steps and its
-- published versions.
--
--   * audit_reports: one working report per engagement, edited by the auditor only. States:
--     draft -> in_review -> published. Editing a published report starts the next version as a
--     draft; the published version stays visible to the client until it is replaced or
--     unpublished.
--   * report_steps: improvement steps attached to an approved opportunity. Proposed by the
--     rule-based matcher (source 'rule'), by a model draft ('ai') or written by the auditor
--     ('auditor'). The text is copied from the catalogue so later catalogue edits change nothing.
--   * audit_report_versions: the frozen, aggregate-only snapshot shown to the client and printed
--     to PDF. Rows are never deleted by the app; unpublishing sets `unpublished_at`.
--
-- All three tables are tenant scoped with the same RLS pattern as analyses and opportunities.
-- Forward only.

BEGIN;

SET LOCAL app.is_service_account = 'on';

CREATE TABLE audit_reports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engagement_id      UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'published')),
  -- Version being edited (or the published one when status = 'published'). Starts at 1.
  version            INTEGER NOT NULL DEFAULT 1 CHECK (version BETWEEN 1 AND 1000),
  locale             TEXT NOT NULL CHECK (locale IN ('fr', 'en')),
  title              TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  summary            TEXT NOT NULL DEFAULT '' CHECK (char_length(summary) <= 6000),
  -- Keys of the approved findings the summary rests on.
  summary_citations  JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks_note         TEXT NOT NULL DEFAULT '' CHECK (char_length(risks_note) <= 6000),
  methodology        TEXT NOT NULL DEFAULT '' CHECK (char_length(methodology) <= 4000),
  plan_json          JSONB NOT NULL DEFAULT '[]'::jsonb,
  catalogue_version  TEXT NOT NULL,
  -- Last model draft of the summary (route, prompt version, cost, cited finding keys). A draft:
  -- it never reaches the client unless the auditor copies it into `summary`.
  ai_draft_json      JSONB,
  created_by         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (engagement_id)
);
CREATE INDEX audit_reports_tenant_idx ON audit_reports (tenant_id, updated_at DESC);

CREATE TABLE report_steps (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_id        UUID NOT NULL REFERENCES audit_reports(id) ON DELETE CASCADE,
  opportunity_id   UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  catalogue_id     TEXT,
  source           TEXT NOT NULL CHECK (source IN ('rule', 'ai', 'auditor')),
  status           TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'rejected')),
  category         TEXT NOT NULL CHECK (category IN
                     ('simplify', 'automate', 'train', 'ai_assistant', 'data_access', 'governance')),
  title            TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description      TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  effort           TEXT NOT NULL CHECK (effort IN ('low', 'medium', 'high')),
  impact           TEXT NOT NULL CHECK (impact IN ('low', 'medium', 'high')),
  risk             TEXT NOT NULL CHECK (risk IN ('low', 'medium', 'high')),
  owner            TEXT NOT NULL DEFAULT '' CHECK (char_length(owner) <= 120),
  horizon          TEXT NOT NULL CHECK (horizon IN ('d30', 'd60', 'd90')),
  prerequisites    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Why the matcher proposed it: the evidence tags and the score. Never answer text.
  match_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  position         INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- A catalogue entry is proposed once per opportunity; steps the auditor writes have no entry.
CREATE UNIQUE INDEX report_steps_catalogue_uniq
  ON report_steps (report_id, opportunity_id, catalogue_id) WHERE catalogue_id IS NOT NULL;
CREATE INDEX report_steps_report_idx ON report_steps (tenant_id, report_id, position);

CREATE TABLE audit_report_versions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_id        UUID NOT NULL REFERENCES audit_reports(id) ON DELETE CASCADE,
  engagement_id    UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  version          INTEGER NOT NULL CHECK (version BETWEEN 1 AND 1000),
  snapshot_json    JSONB NOT NULL,
  published_by     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  published_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  unpublished_at   TIMESTAMPTZ,
  unpublished_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (report_id, version)
);
CREATE INDEX audit_report_versions_visible_idx
  ON audit_report_versions (tenant_id, engagement_id, published_at DESC)
  WHERE unpublished_at IS NULL;

ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE report_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_steps FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_report_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_report_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_reports_select ON audit_reports FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY audit_reports_insert ON audit_reports FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY audit_reports_update ON audit_reports FOR UPDATE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY audit_reports_delete ON audit_reports FOR DELETE USING (app_is_service_account());

CREATE POLICY report_steps_select ON report_steps FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY report_steps_insert ON report_steps FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY report_steps_update ON report_steps FOR UPDATE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY report_steps_delete ON report_steps FOR DELETE USING (app_is_service_account());

CREATE POLICY audit_report_versions_select ON audit_report_versions FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY audit_report_versions_insert ON audit_report_versions FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
-- Only the unpublish columns change after insert; the app never rewrites a snapshot.
CREATE POLICY audit_report_versions_update ON audit_report_versions FOR UPDATE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY audit_report_versions_delete ON audit_report_versions FOR DELETE
  USING (app_is_service_account());

-- The default privileges of 0004 grant everything; narrow them. Snapshots are append-only apart
-- from the two unpublish columns, and nothing here is deleted by the app.
REVOKE DELETE ON audit_reports, report_steps FROM auditai_app;
REVOKE UPDATE, DELETE ON audit_report_versions FROM auditai_app;
GRANT SELECT, INSERT, UPDATE ON audit_reports TO auditai_app;
GRANT SELECT, INSERT, UPDATE ON report_steps TO auditai_app;
GRANT SELECT, INSERT ON audit_report_versions TO auditai_app;
GRANT UPDATE (unpublished_at, unpublished_by) ON audit_report_versions TO auditai_app;

-- Audit verbs. The list keeps every verb of 0022 (TASK-U) so the order these two migrations are
-- applied in does not matter.
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
