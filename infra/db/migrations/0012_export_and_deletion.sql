-- 0012_export_and_deletion.sql
--
-- M15 (FR-09, PRD §15, §25.4): tenant-scoped export + deletion trail.
--
-- Two new append-only tables. Both follow the standard four-policy RLS
-- pattern (select / insert / update / delete, service-account fallback).
-- The trail is the source of truth for both the analyst export and the
-- right-to-erasure flow; the rows themselves are removed by the
-- retention worker that lives in `services/ai`.
--
-- Privacy + retention:
--  * `deletion_events` carries the `target_kind` + `target_id` it removed
--    so the audit trail is reconstructable.
--  * `export_requests` carries the `row_count` of the export so capacity
--    planning has a per-tenant signal.
--  * Both tables carry `tenant_id` (NOT NULL, FK on tenants).

BEGIN;

SET LOCAL app.is_service_account = 'on';

CREATE TABLE export_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requested_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  kind              TEXT NOT NULL CHECK (kind IN (
      'opportunities',
      'analyses',
      'respondent_badges',
      'team_badges',
      'synergies',
      'audit_log'
    )),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed', 'failed')),
  row_count         INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX export_requests_tenant_created_idx
  ON export_requests (tenant_id, created_at DESC);

ALTER TABLE export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY export_requests_select ON export_requests FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY export_requests_insert ON export_requests FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY export_requests_update ON export_requests FOR UPDATE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
-- DELETE reserved for the cleanup worker (service-account).
CREATE POLICY export_requests_delete ON export_requests FOR DELETE
  USING (app_is_service_account());

GRANT SELECT, INSERT, UPDATE, DELETE ON export_requests TO auditai_app;

-- ---------------------------------------------------------------------------

CREATE TABLE deletion_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requested_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  scope             TEXT NOT NULL CHECK (scope IN (
      'respondent_pseudonym',
      'retention_expired',
      'engagement',
      'tenant'
    )),
  -- For scope='respondent_pseudonym' the pseudonym is set; for the
  -- 'retention_expired' scope the worker writes the pseudonym of the
  -- row it purged.
  respondent_pseudonym TEXT,
  target_kind       TEXT NOT NULL CHECK (target_kind IN (
      'respondent_badge',
      'synergy',
      'opportunity',
      'analysis',
      'audit_log',
      'export_request'
    )),
  target_id         UUID,
  audit_log_id      UUID REFERENCES audit_log(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX deletion_events_tenant_created_idx
  ON deletion_events (tenant_id, created_at DESC);
CREATE INDEX deletion_events_pseudonym_idx
  ON deletion_events (tenant_id, respondent_pseudonym)
  WHERE respondent_pseudonym IS NOT NULL;

ALTER TABLE deletion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_events FORCE ROW LEVEL SECURITY;

CREATE POLICY deletion_events_select ON deletion_events FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY deletion_events_insert ON deletion_events FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
-- Updates and deletes blocked; the trail is append-only (PRD §25.4).
CREATE POLICY deletion_events_no_update ON deletion_events FOR UPDATE
  USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY deletion_events_no_delete ON deletion_events FOR DELETE
  USING (FALSE);

GRANT SELECT, INSERT ON deletion_events TO auditai_app;

COMMIT;
