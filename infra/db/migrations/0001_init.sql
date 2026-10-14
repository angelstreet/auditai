-- 0001_init.sql
-- Baseline schema for auditAI Phase 1 entities (PRD \u00a711, \u00a714, \u00a715, \u00a725.1).
--
-- Conventions:
--   * Every client-owned table has `tenant_id UUID NOT NULL` (PRD \u00a714).
--   * UUIDs are v4 generated client-side or by the migration for synthetic seeds only.
--   * `created_at` / `updated_at` are `TIMESTAMPTZ`. The default `now()` is UTC.
--   * Foreign keys are enforced; cascades are explicit, never implicit.
--   * No raw names, no employee PII beyond the pseudonym column.
--
-- The RLS policies that gate every tenant-scoped read/write live in 0002_rls.sql.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------
CREATE TABLE tenants (
  id              UUID PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  plan            TEXT NOT NULL CHECK (plan IN ('self_hosted', 'consultant_managed', 'shared_hosted')),
  data_region     TEXT NOT NULL,
  retention_days  INTEGER CHECK (retention_days IS NULL OR (retention_days BETWEEN 1 AND 3650)),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ
);

CREATE INDEX tenants_slug_idx ON tenants (slug);

-- ---------------------------------------------------------------------------
-- Organisations, departments, teams (PRD \u00a714)
-- ---------------------------------------------------------------------------
CREATE TABLE organisations (
  id              UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  legal_name      TEXT NOT NULL,
  trading_name    TEXT,
  country         TEXT NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  sector          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ
);
CREATE INDEX organisations_tenant_idx ON organisations (tenant_id);

CREATE TABLE departments (
  id              UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  code            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ,
  UNIQUE (organisation_id, code)
);
CREATE INDEX departments_tenant_idx ON departments (tenant_id);

CREATE TABLE teams (
  id                  UUID PRIMARY KEY,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  department_id       UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  expected_headcount  INTEGER NOT NULL CHECK (expected_headcount BETWEEN 0 AND 10000),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ
);
CREATE INDEX teams_tenant_idx ON teams (tenant_id);

-- ---------------------------------------------------------------------------
-- Users and memberships (PRD \u00a73)
-- ---------------------------------------------------------------------------
-- users are not tenant-scoped on purpose: one human can hold memberships across tenants.
CREATE TABLE users (
  id          UUID PRIMARY KEY,
  email_hash  TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id          UUID PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id     UUID REFERENCES teams(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN (
      'platform_owner','client_sponsor','team_manager','team_referent',
      'auditor','security_reviewer','employee_respondent'
    )),
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ,
  CHECK (team_id IS NOT NULL OR role IN ('platform_owner','client_sponsor','auditor','security_reviewer'))
);
CREATE INDEX memberships_tenant_idx ON memberships (tenant_id);
CREATE INDEX memberships_user_idx ON memberships (user_id);

-- ---------------------------------------------------------------------------
-- Templates and question items (PRD \u00a76.1)
-- ---------------------------------------------------------------------------
CREATE TABLE templates (
  id              UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  owner_user_id   UUID REFERENCES users(id),
  default_locale  TEXT NOT NULL CHECK (default_locale IN ('fr','en')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ
);
CREATE INDEX templates_tenant_idx ON templates (tenant_id);

CREATE TABLE question_items (
  id            UUID PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  axis          TEXT NOT NULL CHECK (axis IN ('literacy','practice','readiness','opportunity','context')),
  code          TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('single_choice','multi_choice','short_text','scale_5','boolean','scenario_choice')),
  locale        TEXT NOT NULL CHECK (locale IN ('fr','en')),
  prompt        TEXT NOT NULL,
  helper        TEXT,
  options_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  scoring_json  JSONB NOT NULL,
  sensitivity   TEXT NOT NULL CHECK (sensitivity IN ('public','internal','sensitive')),
  retestable    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ,
  UNIQUE (tenant_id, code)
);
CREATE INDEX question_items_tenant_idx ON question_items (tenant_id);

CREATE TABLE questionnaire_versions (
  id                UUID PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id       UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version_number    INTEGER NOT NULL CHECK (version_number BETWEEN 1 AND 1000),
  item_ids          UUID[] NOT NULL CHECK (cardinality(item_ids) BETWEEN 1 AND 200),
  translations_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_locale     TEXT NOT NULL CHECK (source_locale IN ('fr','en')),
  frozen_at         TIMESTAMPTZ NOT NULL,
  change_note       TEXT,
  UNIQUE (template_id, version_number)
);
CREATE INDEX questionnaire_versions_tenant_idx ON questionnaire_versions (tenant_id);

-- ---------------------------------------------------------------------------
-- Engagements (PRD \u00a714)
-- ---------------------------------------------------------------------------
CREATE TABLE engagements (
  id                       UUID PRIMARY KEY,
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id              UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  questionnaire_version_id UUID NOT NULL REFERENCES questionnaire_versions(id) ON DELETE RESTRICT,
  status                   TEXT NOT NULL CHECK (status IN ('draft','scheduled','in_field','analysis','review','closed','archived')),
  opens_at                 TIMESTAMPTZ,
  closes_at                TIMESTAMPTZ,
  locale                   TEXT NOT NULL CHECK (locale IN ('fr','en')),
  privacy_json             JSONB NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ
);
CREATE INDEX engagements_tenant_idx ON engagements (tenant_id);

CREATE TABLE engagement_teams (
  engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  PRIMARY KEY (engagement_id, team_id)
);
CREATE INDEX engagement_teams_tenant_idx ON engagement_teams (tenant_id);

-- ---------------------------------------------------------------------------
-- Invitations, respondents, submissions, answers (PRD \u00a75, \u00a714, \u00a716)
-- ---------------------------------------------------------------------------
CREATE TABLE invitations (
  id                   UUID PRIMARY KEY,
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engagement_id        UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  team_id              UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  respondent_pseudonym TEXT NOT NULL,
  status               TEXT NOT NULL CHECK (status IN ('pending','opened','in_progress','submitted','declined','expired','revoked')),
  token_reference      TEXT NOT NULL,
  token_signature      TEXT NOT NULL,
  opens_at             TIMESTAMPTZ NOT NULL,
  expires_at           TIMESTAMPTZ NOT NULL,
  open_count           INTEGER NOT NULL DEFAULT 0 CHECK (open_count BETWEEN 0 AND 1000),
  submission_id        UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ,
  UNIQUE (engagement_id, respondent_pseudonym)
);
CREATE INDEX invitations_tenant_idx ON invitations (tenant_id);
CREATE INDEX invitations_team_idx ON invitations (team_id);

CREATE TABLE respondents (
  id                  UUID PRIMARY KEY,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invitation_id       UUID NOT NULL UNIQUE REFERENCES invitations(id) ON DELETE CASCADE,
  pseudonym           TEXT NOT NULL,
  preferred_locale    TEXT NOT NULL CHECK (preferred_locale IN ('fr','en')),
  first_opened_at     TIMESTAMPTZ,
  last_seen_at        TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ
);
CREATE INDEX respondents_tenant_idx ON respondents (tenant_id);

CREATE TABLE submissions (
  id                       UUID PRIMARY KEY,
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engagement_id            UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  questionnaire_version_id UUID NOT NULL REFERENCES questionnaire_versions(id) ON DELETE RESTRICT,
  invitation_id            UUID NOT NULL UNIQUE REFERENCES invitations(id) ON DELETE CASCADE,
  status                   TEXT NOT NULL CHECK (status IN ('in_progress','submitted','abandoned','expired')),
  locale                   TEXT NOT NULL CHECK (locale IN ('fr','en')),
  active_duration_ms       INTEGER CHECK (active_duration_ms IS NULL OR active_duration_ms BETWEEN 0 AND 21600000),
  started_at               TIMESTAMPTZ NOT NULL,
  submitted_at             TIMESTAMPTZ,
  end_comment              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ
);
CREATE INDEX submissions_tenant_idx ON submissions (tenant_id);

CREATE TABLE answers (
  id                UUID PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  submission_id     UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  question_item_id  UUID NOT NULL REFERENCES question_items(id) ON DELETE RESTRICT,
  value_json        JSONB NOT NULL,
  confidence        INTEGER CHECK (confidence IS NULL OR confidence BETWEEN 1 AND 5),
  rationale         TEXT,
  duration_ms       INTEGER CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 21600000),
  sequence          INTEGER NOT NULL CHECK (sequence BETWEEN 0 AND 1000),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ,
  UNIQUE (submission_id, question_item_id, sequence)
);
CREATE INDEX answers_tenant_idx ON answers (tenant_id);

COMMIT;