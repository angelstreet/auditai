-- 0003_seed_synthetic.sql
--
-- Synthetic seed data for local development and tests. Names, organisations and emails are
-- obviously fictional and contain the substring "synthetic" so the leak-scan allowlist can stay
-- empty. Do not use this migration in any environment that holds real customer data.

BEGIN;

SET LOCAL app.is_service_account = 'on';

INSERT INTO tenants (id, slug, display_name, plan, data_region, retention_days) VALUES
  ('11111111-1111-4111-8111-111111111111', 'synthetic-tenant-a', 'Synthetic tenant A', 'self_hosted', 'EU', 365),
  ('22222222-2222-4222-8222-222222222222', 'synthetic-tenant-b', 'Synthetic tenant B', 'self_hosted', 'EU', 365);

INSERT INTO organisations (id, tenant_id, legal_name, trading_name, country, sector) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Synthetic Co A s\u00e0rl', 'Synthetic Co A', 'FR', 'consulting'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'Synthetic Co B s\u00e0rl', 'Synthetic Co B', 'FR', 'consulting');

INSERT INTO departments (id, tenant_id, organisation_id, name, code) VALUES
  ('a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Operations', 'ops'),
  ('b1111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Operations', 'ops');

INSERT INTO teams (id, tenant_id, organisation_id, department_id, name, description, expected_headcount) VALUES
  ('a2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a1111111-1111-4111-8111-111111111111', 'Synthetic team A', 'Synthetic team in tenant A', 12),
  ('b2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b1111111-1111-4111-8111-111111111111', 'Synthetic team B', 'Synthetic team in tenant B', 9);

INSERT INTO templates (id, tenant_id, name, owner_user_id, default_locale) VALUES
  ('a3333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Synthetic calibration A', NULL, 'fr'),
  ('b3333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'Synthetic calibration B', NULL, 'fr');

INSERT INTO question_items (id, tenant_id, axis, code, kind, locale, prompt, options_json, scoring_json, sensitivity, retestable) VALUES
  ('a3333333-4333-4333-8333-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'literacy', 'synthetic_check_source', 'scenario_choice', 'fr', 'V\u00e9rifier la source', '[{"value":"low","label":"low"},{"value":"high","label":"high"}]'::jsonb, '{"weight":1,"reverse":false}'::jsonb, 'internal', true),
  ('b3333333-4333-4333-8333-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'literacy', 'synthetic_check_source', 'scenario_choice', 'fr', 'V\u00e9rifier la source', '[{"value":"low","label":"low"},{"value":"high","label":"high"}]'::jsonb, '{"weight":1,"reverse":false}'::jsonb, 'internal', true);

INSERT INTO questionnaire_versions (id, tenant_id, template_id, version_number, item_ids, source_locale, frozen_at) VALUES
  ('a4444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'a3333333-3333-4333-8333-333333333333', 1, ARRAY['a3333333-4333-4333-8333-aaaaaaaaaaaa']::uuid[], 'fr', now()),
  ('b4444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', 'b3333333-3333-4333-8333-333333333333', 1, ARRAY['b3333333-4333-4333-8333-bbbbbbbbbbbb']::uuid[], 'fr', now());

INSERT INTO engagements (id, tenant_id, template_id, questionnaire_version_id, status, opens_at, closes_at, locale, privacy_json) VALUES
  ('a5555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'a3333333-3333-4333-8333-333333333333', 'a4444444-4444-4444-8444-444444444444', 'scheduled', now(), now() + interval '14 days', 'fr', '{"minResponsesForGroupBreakdown":5,"managerSeesIndividualMaturity":false,"benchmarkCandidate":false,"noticeLocale":"fr"}'::jsonb),
  ('b5555555-5555-4555-8555-555555555555', '22222222-2222-4222-8222-222222222222', 'b3333333-3333-4333-8333-333333333333', 'b4444444-4444-4444-8444-444444444444', 'scheduled', now(), now() + interval '14 days', 'fr', '{"minResponsesForGroupBreakdown":5,"managerSeesIndividualMaturity":false,"benchmarkCandidate":false,"noticeLocale":"fr"}'::jsonb);

INSERT INTO engagement_teams (engagement_id, team_id, tenant_id) VALUES
  ('a5555555-5555-4555-8555-555555555555', 'a2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111'),
  ('b5555555-5555-4555-8555-555555555555', 'b2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222');

INSERT INTO invitations (id, tenant_id, engagement_id, team_id, respondent_pseudonym, status, token_reference, token_signature, opens_at, expires_at, open_count, submission_id) VALUES
  ('a6666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111', 'a5555555-5555-4555-8555-555555555555', 'a2222222-2222-4222-8222-222222222222', 'synthetic-employee-001', 'pending', 'inv-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'signature-aaaaaaaaaaaaaaaaaaaaaaaaaaaa', now(), now() + interval '7 days', 0, NULL),
  ('b6666666-6666-4666-8666-666666666666', '22222222-2222-4222-8222-222222222222', 'b5555555-5555-4555-8555-555555555555', 'b2222222-2222-4222-8222-222222222222', 'synthetic-employee-001', 'pending', 'inv-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'signature-bbbbbbbbbbbbbbbbbbbbbbbbbbbb', now(), now() + interval '7 days', 0, NULL);

COMMIT;