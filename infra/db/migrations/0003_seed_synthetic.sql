-- 0003_seed_synthetic.sql
--
-- Synthetic seed data for local development and tests. Names, organisations and emails are
-- obviously fictional and contain the substring "synthetic" so the leak-scan allowlist can stay
-- empty. Do not use this migration in any environment that holds real customer data.
--
-- The completion counts (tenant A: 5/12, tenant B: 3/9) and the engagement UUIDs are the
-- anchors that apps/web/e2e/admin-engagements.spec.ts asserts on, so any change here must
-- be reflected there.

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

-- Question items: one row per code, per tenant. The codes match the synthetic survey
-- template in apps/web/src/lib/syntheticTemplate.ts so the API can look up the UUID.
INSERT INTO question_items (id, tenant_id, axis, code, kind, locale, prompt, options_json, scoring_json, sensitivity, retestable) VALUES
  ('a3333333-4333-4333-8333-aaaaaaaaaa01', '11111111-1111-4111-8111-111111111111', 'literacy',  'synthetic_source_checking',    'scenario_choice', 'fr', 'V\u00e9rifier la source',         '[{"value":"use_as_is","label":"low"},{"value":"verify_source","label":"high"}]'::jsonb, '{"weight":1,"reverse":false}'::jsonb, 'internal', true),
  ('a3333333-4333-4333-8333-aaaaaaaaaa02', '11111111-1111-4111-8111-111111111111', 'literacy',  'synthetic_data_safety',        'scenario_choice', 'fr', 'S\u00e9curit\u00e9 des donn\u00e9es',     '[{"value":"paste_anyway","label":"low"},{"value":"check_policy","label":"high"}]'::jsonb, '{"weight":1,"reverse":false}'::jsonb, 'internal', true),
  ('a3333333-4333-4333-8333-aaaaaaaaaa03', '11111111-1111-4111-8111-111111111111', 'literacy',  'synthetic_prompting',          'scenario_choice', 'fr', 'Qualit\u00e9 du brief',             '[{"value":"short_vague","label":"low"},{"value":"specific_brief","label":"high"}]'::jsonb, '{"weight":1,"reverse":false}'::jsonb, 'internal', true),
  ('a3333333-4333-4333-8333-aaaaaaaaaa04', '11111111-1111-4111-8111-111111111111', 'context',   'synthetic_workflow',           'scenario_choice', 'fr', 'Cartographie du flux',          '[{"value":"jump_to_ai","label":"low"},{"value":"map_first","label":"high"}]'::jsonb, '{"weight":1,"reverse":false}'::jsonb, 'internal', true),
  ('a3333333-4333-4333-8333-aaaaaaaaaa05', '11111111-1111-4111-8111-111111111111', 'literacy',  'synthetic_automation_choice', 'scenario_choice', 'fr', 'Automatisation vs IA',         '[{"value":"always_ai","label":"low"},{"value":"deterministic_first","label":"high"}]'::jsonb, '{"weight":1,"reverse":false}'::jsonb, 'internal', true),
  ('a3333333-4333-4333-8333-aaaaaaaaaa06', '11111111-1111-4111-8111-111111111111', 'practice',  'synthetic_context_time',       'scenario_choice', 'fr', 'Temps hebdomadaire',          '[{"value":"lt_1h","label":"low"},{"value":"1_3h","label":"low"},{"value":"3_6h","label":"high"},{"value":"gt_6h","label":"high"}]'::jsonb, '{"weight":1,"reverse":false}'::jsonb, 'internal', true),
  ('b3333333-4333-4333-8333-bbbbbbbbbb01', '22222222-2222-4222-8222-222222222222', 'literacy',  'synthetic_source_checking',    'scenario_choice', 'fr', 'V\u00e9rifier la source',         '[{"value":"use_as_is","label":"low"},{"value":"verify_source","label":"high"}]'::jsonb, '{"weight":1,"reverse":false}'::jsonb, 'internal', true),
  ('b3333333-4333-4333-8333-bbbbbbbbbb02', '22222222-2222-4222-8222-222222222222', 'literacy',  'synthetic_data_safety',        'scenario_choice', 'fr', 'S\u00e9curit\u00e9 des donn\u00e9es',     '[{"value":"paste_anyway","label":"low"},{"value":"check_policy","label":"high"}]'::jsonb, '{"weight":1,"reverse":false}'::jsonb, 'internal', true),
  ('b3333333-4333-4333-8333-bbbbbbbbbb03', '22222222-2222-4222-8222-222222222222', 'literacy',  'synthetic_prompting',          'scenario_choice', 'fr', 'Qualit\u00e9 du brief',             '[{"value":"short_vague","label":"low"},{"value":"specific_brief","label":"high"}]'::jsonb, '{"weight":1,"reverse":false}'::jsonb, 'internal', true),
  ('b3333333-4333-4333-8333-bbbbbbbbbb04', '22222222-2222-4222-8222-222222222222', 'context',   'synthetic_workflow',           'scenario_choice', 'fr', 'Cartographie du flux',          '[{"value":"jump_to_ai","label":"low"},{"value":"map_first","label":"high"}]'::jsonb, '{"weight":1,"reverse":false}'::jsonb, 'internal', true),
  ('b3333333-4333-4333-8333-bbbbbbbbbb05', '22222222-2222-4222-8222-222222222222', 'literacy',  'synthetic_automation_choice', 'scenario_choice', 'fr', 'S\u00e9curit\u00e9 vs IA',          '[{"value":"always_ai","label":"low"},{"value":"check_policy","label":"high"}]'::jsonb, '{"weight":1,"reverse":false}'::jsonb, 'internal', true),
  ('b3333333-4333-4333-8333-bbbbbbbbbb06', '22222222-2222-4222-8222-222222222222', 'practice',  'synthetic_context_time',       'scenario_choice', 'fr', 'Temps hebdomadaire',          '[{"value":"lt_1h","label":"low"},{"value":"1_3h","label":"low"},{"value":"3_6h","label":"high"},{"value":"gt_6h","label":"high"}]'::jsonb, '{"weight":1,"reverse":false}'::jsonb, 'internal', true);

INSERT INTO questionnaire_versions (id, tenant_id, template_id, version_number, item_ids, source_locale, frozen_at) VALUES
  ('a4444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'a3333333-3333-4333-8333-333333333333', 1, ARRAY[
     'a3333333-4333-4333-8333-aaaaaaaaaa01',
     'a3333333-4333-4333-8333-aaaaaaaaaa02',
     'a3333333-4333-4333-8333-aaaaaaaaaa03',
     'a3333333-4333-4333-8333-aaaaaaaaaa04',
     'a3333333-4333-4333-8333-aaaaaaaaaa05',
     'a3333333-4333-4333-8333-aaaaaaaaaa06'
   ]::uuid[], 'fr', now()),
  ('b4444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', 'b3333333-3333-4333-8333-333333333333', 1, ARRAY[
     'b3333333-4333-4333-8333-bbbbbbbbbb01',
     'b3333333-4333-4333-8333-bbbbbbbbbb02',
     'b3333333-4333-4333-8333-bbbbbbbbbb03',
     'b3333333-4333-4333-8333-bbbbbbbbbb04',
     'b3333333-4333-4333-8333-bbbbbbbbbb05',
     'b3333333-4333-4333-8333-bbbbbbbbbb06'
   ]::uuid[], 'fr', now());

-- Engagement UUIDs match the anchors asserted by apps/web/e2e/admin-engagements.spec.ts.
INSERT INTO engagements (id, tenant_id, template_id, questionnaire_version_id, status, opens_at, closes_at, locale, privacy_json) VALUES
  ('a5555555-4555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'a3333333-3333-4333-8333-333333333333', 'a4444444-4444-4444-8444-444444444444', 'scheduled', now(), now() + interval '14 days', 'fr', '{"minResponsesForGroupBreakdown":5,"managerSeesIndividualMaturity":false,"benchmarkCandidate":false,"noticeLocale":"fr"}'::jsonb),
  ('b5555555-4555-4555-8555-555555555555', '22222222-2222-4222-8222-222222222222', 'b3333333-3333-4333-8333-333333333333', 'b4444444-4444-4444-8444-444444444444', 'scheduled', now(), now() + interval '14 days', 'fr', '{"minResponsesForGroupBreakdown":5,"managerSeesIndividualMaturity":false,"benchmarkCandidate":false,"noticeLocale":"fr"}'::jsonb);

INSERT INTO engagement_teams (engagement_id, team_id, tenant_id) VALUES
  ('a5555555-4555-4555-8555-555555555555', 'a2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111'),
  ('b5555555-4555-4555-8555-555555555555', 'b2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222');

-- ---------------------------------------------------------------------------
-- Invitations: 12 for tenant A (5 submitted + 1 in_progress + 1 opened + 5 pending)
-- and 9 for tenant B (3 submitted + 1 in_progress + 1 opened + 4 pending).
-- Submission counts are the anchor for admin-engagements.spec.ts:
-- tenant A 5/12 = 42%, tenant B 3/9 = 33%.
-- ---------------------------------------------------------------------------

-- Tenant A pending + non-submitted open invitations (7 rows). The fifth pending row is
-- `inv-synthetic-pilot-001`, which the /about page uses to mint a signed token.
INSERT INTO invitations (id, tenant_id, engagement_id, team_id, respondent_pseudonym, status, token_reference, token_signature, opens_at, expires_at, open_count, submission_id) VALUES
  ('a6666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a2222222-2222-4222-8222-222222222222', 'synthetic-employee-001', 'pending', 'inv-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'signature-aaaaaaaaaaaaaaaaaaaaaaaaaaaa', now(), now() + interval '7 days', 0, NULL),
  ('a6666666-6666-4666-8666-666666666667', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a2222222-2222-4222-8222-222222222222', 'synthetic-employee-002', 'pending', 'inv-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0002', 'sig-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0002', now(), now() + interval '7 days', 0, NULL),
  ('a6666666-6666-4666-8666-666666666668', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a2222222-2222-4222-8222-222222222222', 'synthetic-employee-003', 'pending', 'inv-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0003', 'sig-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0003', now(), now() + interval '7 days', 0, NULL),
  ('a6666666-6666-4666-8666-666666666669', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a2222222-2222-4222-8222-222222222222', 'synthetic-employee-004', 'pending', 'inv-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0004', 'sig-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0004', now(), now() + interval '7 days', 0, NULL),
  ('a7777777-4666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a2222222-2222-4222-8222-222222222222', 'synthetic-employee-demo', 'pending', 'inv-synthetic-pilot-001', 'signature-synthetic-pilot-001', now(), now() + interval '7 days', 0, NULL),
  ('a6666666-6666-4666-8666-66666666666a', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a2222222-2222-4222-8222-222222222222', 'synthetic-employee-005', 'opened',  'inv-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0005', 'sig-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0005', now(), now() + interval '7 days', 1, NULL),
  ('a6666666-6666-4666-8666-66666666666b', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a2222222-2222-4222-8222-222222222222', 'synthetic-employee-006', 'in_progress', 'inv-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0006', 'sig-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0006', now(), now() + interval '7 days', 2, NULL);

-- Tenant A submitted invitations (5 rows). Inserted before their submissions because of FK.
INSERT INTO invitations (id, tenant_id, engagement_id, team_id, respondent_pseudonym, status, token_reference, token_signature, opens_at, expires_at, open_count, submission_id) VALUES
  ('a6666666-6666-4666-8666-66666666660c', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a2222222-2222-4222-8222-222222222222', 'synthetic-employee-007', 'submitted', 'inv-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0007', 'sig-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0007', now() - interval '2 days', now() + interval '5 days', 3, 'a8888888-4555-4555-8555-aaaaaaaaaa01'),
  ('a6666666-6666-4666-8666-66666666660d', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a2222222-2222-4222-8222-222222222222', 'synthetic-employee-008', 'submitted', 'inv-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0008', 'sig-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0008', now() - interval '1 day',  now() + interval '6 days', 2, 'a8888888-4555-4555-8555-aaaaaaaaaa02'),
  ('a6666666-6666-4666-8666-66666666660e', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a2222222-2222-4222-8222-222222222222', 'synthetic-employee-009', 'submitted', 'inv-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0009', 'sig-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0009', now() - interval '6 hours', now() + interval '7 days', 1, 'a8888888-4555-4555-8555-aaaaaaaaaa03'),
  ('a6666666-6666-4666-8666-66666666660f', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a2222222-2222-4222-8222-222222222222', 'synthetic-employee-010', 'submitted', 'inv-synthetic-aaaa-aaaa-aaaa-aaaaaaaa000a', 'sig-synthetic-aaaa-aaaa-aaaa-aaaaaaaa000a', now() - interval '3 hours', now() + interval '7 days', 1, 'a8888888-4555-4555-8555-aaaaaaaaaa04'),
  ('a6666666-6666-4666-8666-666666666610', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a2222222-2222-4222-8222-222222222222', 'synthetic-employee-011', 'submitted', 'inv-synthetic-aaaa-aaaa-aaaa-aaaaaaaa000b', 'sig-synthetic-aaaa-aaaa-aaaa-aaaaaaaa000b', now() - interval '1 hour',  now() + interval '7 days', 1, 'a8888888-4555-4555-8555-aaaaaaaaaa05');

INSERT INTO submissions (id, tenant_id, engagement_id, questionnaire_version_id, invitation_id, status, locale, started_at, submitted_at) VALUES
  ('a8888888-4555-4555-8555-aaaaaaaaaa01', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a4444444-4444-4444-8444-444444444444', 'a6666666-6666-4666-8666-66666666660c', 'submitted', 'fr', now() - interval '2 days', now() - interval '2 days' + interval '5 minutes'),
  ('a8888888-4555-4555-8555-aaaaaaaaaa02', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a4444444-4444-4444-8444-444444444444', 'a6666666-6666-4666-8666-66666666660d', 'submitted', 'fr', now() - interval '1 day',  now() - interval '1 day'  + interval '4 minutes'),
  ('a8888888-4555-4555-8555-aaaaaaaaaa03', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a4444444-4444-4444-8444-444444444444', 'a6666666-6666-4666-8666-66666666660e', 'submitted', 'fr', now() - interval '6 hours', now() - interval '6 hours' + interval '6 minutes'),
  ('a8888888-4555-4555-8555-aaaaaaaaaa04', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a4444444-4444-4444-8444-444444444444', 'a6666666-6666-4666-8666-66666666660f', 'submitted', 'fr', now() - interval '3 hours', now() - interval '3 hours' + interval '5 minutes'),
  ('a8888888-4555-4555-8555-aaaaaaaaaa05', '11111111-1111-4111-8111-111111111111', 'a5555555-4555-4555-8555-555555555555', 'a4444444-4444-4444-8444-444444444444', 'a6666666-6666-4666-8666-666666666610', 'submitted', 'fr', now() - interval '1 hour',  now() - interval '1 hour'  + interval '7 minutes');

-- Six answers per submitted invitation for tenant A.
INSERT INTO answers (id, tenant_id, submission_id, question_item_id, value_json, sequence) VALUES
  -- submission 01
  ('a9999999-4555-4555-8555-aaaaaaaaaa01', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa01', 'a3333333-4333-4333-8333-aaaaaaaaaa01', '"verify_source"'::jsonb, 0),
  ('a9999999-4555-4555-8555-aaaaaaaaaa02', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa01', 'a3333333-4333-4333-8333-aaaaaaaaaa02', '"check_policy"'::jsonb, 1),
  ('a9999999-4555-4555-8555-aaaaaaaaaa03', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa01', 'a3333333-4333-4333-8333-aaaaaaaaaa03', '"specific_brief"'::jsonb, 2),
  ('a9999999-4555-4555-8555-aaaaaaaaaa04', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa01', 'a3333333-4333-4333-8333-aaaaaaaaaa04', '"map_first"'::jsonb, 3),
  ('a9999999-4555-4555-8555-aaaaaaaaaa05', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa01', 'a3333333-4333-4333-8333-aaaaaaaaaa05', '"deterministic_first"'::jsonb, 4),
  ('a9999999-4555-4555-8555-aaaaaaaaaa06', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa01', 'a3333333-4333-4333-8333-aaaaaaaaaa06', '"1_3h"'::jsonb, 5),
  -- submission 02
  ('a9999999-4555-4555-8555-aaaaaaaaaa07', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa02', 'a3333333-4333-4333-8333-aaaaaaaaaa01', '"verify_source"'::jsonb, 0),
  ('a9999999-4555-4555-8555-aaaaaaaaaa08', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa02', 'a3333333-4333-4333-8333-aaaaaaaaaa02', '"check_policy"'::jsonb, 1),
  ('a9999999-4555-4555-8555-aaaaaaaaaa09', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa02', 'a3333333-4333-4333-8333-aaaaaaaaaa03', '"specific_brief"'::jsonb, 2),
  ('a9999999-4555-4555-8555-aaaaaaaaaa0a', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa02', 'a3333333-4333-4333-8333-aaaaaaaaaa04', '"map_first"'::jsonb, 3),
  ('a9999999-4555-4555-8555-aaaaaaaaaa0b', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa02', 'a3333333-4333-4333-8333-aaaaaaaaaa05', '"always_ai"'::jsonb, 4),
  ('a9999999-4555-4555-8555-aaaaaaaaaa0c', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa02', 'a3333333-4333-4333-8333-aaaaaaaaaa06', '"3_6h"'::jsonb, 5),
  -- submission 03
  ('a9999999-4555-4555-8555-aaaaaaaaaa0d', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa03', 'a3333333-4333-4333-8333-aaaaaaaaaa01', '"use_as_is"'::jsonb, 0),
  ('a9999999-4555-4555-8555-aaaaaaaaaa0e', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa03', 'a3333333-4333-4333-8333-aaaaaaaaaa02', '"check_policy"'::jsonb, 1),
  ('a9999999-4555-4555-8555-aaaaaaaaaa0f', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa03', 'a3333333-4333-4333-8333-aaaaaaaaaa03', '"specific_brief"'::jsonb, 2),
  ('a9999999-4555-4555-8555-aaaaaaaaaa10', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa03', 'a3333333-4333-4333-8333-aaaaaaaaaa04', '"map_first"'::jsonb, 3),
  ('a9999999-4555-4555-8555-aaaaaaaaaa11', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa03', 'a3333333-4333-4333-8333-aaaaaaaaaa05', '"deterministic_first"'::jsonb, 4),
  ('a9999999-4555-4555-8555-aaaaaaaaaa12', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa03', 'a3333333-4333-4333-8333-aaaaaaaaaa06', '"1_3h"'::jsonb, 5),
  -- submission 04
  ('a9999999-4555-4555-8555-aaaaaaaaaa13', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa04', 'a3333333-4333-4333-8333-aaaaaaaaaa01', '"verify_source"'::jsonb, 0),
  ('a9999999-4555-4555-8555-aaaaaaaaaa14', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa04', 'a3333333-4333-4333-8333-aaaaaaaaaa02', '"paste_anyway"'::jsonb, 1),
  ('a9999999-4555-4555-8555-aaaaaaaaaa15', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa04', 'a3333333-4333-4333-8333-aaaaaaaaaa03', '"short_vague"'::jsonb, 2),
  ('a9999999-4555-4555-8555-aaaaaaaaaa16', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa04', 'a3333333-4333-4333-8333-aaaaaaaaaa04', '"map_first"'::jsonb, 3),
  ('a9999999-4555-4555-8555-aaaaaaaaaa17', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa04', 'a3333333-4333-4333-8333-aaaaaaaaaa05', '"deterministic_first"'::jsonb, 4),
  ('a9999999-4555-4555-8555-aaaaaaaaaa18', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa04', 'a3333333-4333-4333-8333-aaaaaaaaaa06', '"3_6h"'::jsonb, 5),
  -- submission 05
  ('a9999999-4555-4555-8555-aaaaaaaaaa19', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa05', 'a3333333-4333-4333-8333-aaaaaaaaaa01', '"verify_source"'::jsonb, 0),
  ('a9999999-4555-4555-8555-aaaaaaaaaa1a', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa05', 'a3333333-4333-4333-8333-aaaaaaaaaa02', '"check_policy"'::jsonb, 1),
  ('a9999999-4555-4555-8555-aaaaaaaaaa1b', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa05', 'a3333333-4333-4333-8333-aaaaaaaaaa03', '"specific_brief"'::jsonb, 2),
  ('a9999999-4555-4555-8555-aaaaaaaaaa1c', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa05', 'a3333333-4333-4333-8333-aaaaaaaaaa04', '"map_first"'::jsonb, 3),
  ('a9999999-4555-4555-8555-aaaaaaaaaa1d', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa05', 'a3333333-4333-4333-8333-aaaaaaaaaa05', '"deterministic_first"'::jsonb, 4),
  ('a9999999-4555-4555-8555-aaaaaaaaaa1e', '11111111-1111-4111-8111-111111111111', 'a8888888-4555-4555-8555-aaaaaaaaaa05', 'a3333333-4333-4333-8333-aaaaaaaaaa06', '"1_3h"'::jsonb, 5);

-- Tenant B pending + non-submitted open invitations (6 rows).
INSERT INTO invitations (id, tenant_id, engagement_id, team_id, respondent_pseudonym, status, token_reference, token_signature, opens_at, expires_at, open_count, submission_id) VALUES
  ('b6666666-6666-4666-8666-666666666666', '22222222-2222-4222-8222-222222222222', 'b5555555-4555-4555-8555-555555555555', 'b2222222-2222-4222-8222-222222222222', 'synthetic-employee-001', 'pending', 'inv-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'signature-bbbbbbbbbbbbbbbbbbbbbbbbbbbb', now(), now() + interval '7 days', 0, NULL),
  ('b6666666-6666-4666-8666-666666666667', '22222222-2222-4222-8222-222222222222', 'b5555555-4555-4555-8555-555555555555', 'b2222222-2222-4222-8222-222222222222', 'synthetic-employee-002', 'pending', 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0002', 'sig-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0002', now(), now() + interval '7 days', 0, NULL),
  ('b6666666-6666-4666-8666-666666666668', '22222222-2222-4222-8222-222222222222', 'b5555555-4555-4555-8555-555555555555', 'b2222222-2222-4222-8222-222222222222', 'synthetic-employee-003', 'pending', 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0003', 'sig-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0003', now(), now() + interval '7 days', 0, NULL),
  ('b6666666-6666-4666-8666-666666666669', '22222222-2222-4222-8222-222222222222', 'b5555555-4555-4555-8555-555555555555', 'b2222222-2222-4222-8222-222222222222', 'synthetic-employee-004', 'pending', 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0004', 'sig-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0004', now(), now() + interval '7 days', 0, NULL),
  ('b6666666-6666-4666-8666-66666666666a', '22222222-2222-4222-8222-222222222222', 'b5555555-4555-4555-8555-555555555555', 'b2222222-2222-4222-8222-222222222222', 'synthetic-employee-005', 'opened',  'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0005', 'sig-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0005', now(), now() + interval '7 days', 1, NULL),
  ('b6666666-6666-4666-8666-66666666666b', '22222222-2222-4222-8222-222222222222', 'b5555555-4555-4555-8555-555555555555', 'b2222222-2222-4222-8222-222222222222', 'synthetic-employee-006', 'in_progress', 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0006', 'sig-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0006', now(), now() + interval '7 days', 2, NULL);

-- Tenant B submitted invitations (3 rows). Inserted before their submissions because of FK.
INSERT INTO invitations (id, tenant_id, engagement_id, team_id, respondent_pseudonym, status, token_reference, token_signature, opens_at, expires_at, open_count, submission_id) VALUES
  ('b6666666-6666-4666-8666-66666666660c', '22222222-2222-4222-8222-222222222222', 'b5555555-4555-4555-8555-555555555555', 'b2222222-2222-4222-8222-222222222222', 'synthetic-employee-007', 'submitted', 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0007', 'sig-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0007', now() - interval '1 day',  now() + interval '6 days', 2, 'b8888888-4555-4555-8555-bbbbbbbbbb01'),
  ('b6666666-6666-4666-8666-66666666660d', '22222222-2222-4222-8222-222222222222', 'b5555555-4555-4555-8555-555555555555', 'b2222222-2222-4222-8222-222222222222', 'synthetic-employee-008', 'submitted', 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0008', 'sig-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0008', now() - interval '12 hours', now() + interval '6 days', 1, 'b8888888-4555-4555-8555-bbbbbbbbbb02'),
  ('b6666666-6666-4666-8666-66666666660e', '22222222-2222-4222-8222-222222222222', 'b5555555-4555-4555-8555-555555555555', 'b2222222-2222-4222-8222-222222222222', 'synthetic-employee-009', 'submitted', 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0009', 'sig-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0009', now() - interval '2 hours',  now() + interval '7 days', 1, 'b8888888-4555-4555-8555-bbbbbbbbbb03');

INSERT INTO submissions (id, tenant_id, engagement_id, questionnaire_version_id, invitation_id, status, locale, started_at, submitted_at) VALUES
  ('b8888888-4555-4555-8555-bbbbbbbbbb01', '22222222-2222-4222-8222-222222222222', 'b5555555-4555-4555-8555-555555555555', 'b4444444-4444-4444-8444-444444444444', 'b6666666-6666-4666-8666-66666666660c', 'submitted', 'fr', now() - interval '1 day', now() - interval '1 day' + interval '4 minutes'),
  ('b8888888-4555-4555-8555-bbbbbbbbbb02', '22222222-2222-4222-8222-222222222222', 'b5555555-4555-4555-8555-555555555555', 'b4444444-4444-4444-8444-444444444444', 'b6666666-6666-4666-8666-66666666660d', 'submitted', 'fr', now() - interval '12 hours', now() - interval '12 hours' + interval '5 minutes'),
  ('b8888888-4555-4555-8555-bbbbbbbbbb03', '22222222-2222-4222-8222-222222222222', 'b5555555-4555-4555-8555-555555555555', 'b4444444-4444-4444-8444-444444444444', 'b6666666-6666-4666-8666-66666666660e', 'submitted', 'fr', now() - interval '2 hours', now() - interval '2 hours' + interval '6 minutes');

INSERT INTO answers (id, tenant_id, submission_id, question_item_id, value_json, sequence) VALUES
  ('b9999999-4555-4555-8555-bbbbbbbbbb01', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb01', 'b3333333-4333-4333-8333-bbbbbbbbbb01', '"verify_source"'::jsonb, 0),
  ('b9999999-4555-4555-8555-bbbbbbbbbb02', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb01', 'b3333333-4333-4333-8333-bbbbbbbbbb02', '"check_policy"'::jsonb, 1),
  ('b9999999-4555-4555-8555-bbbbbbbbbb03', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb01', 'b3333333-4333-4333-8333-bbbbbbbbbb03', '"specific_brief"'::jsonb, 2),
  ('b9999999-4555-4555-8555-bbbbbbbbbb04', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb01', 'b3333333-4333-4333-8333-bbbbbbbbbb04', '"map_first"'::jsonb, 3),
  ('b9999999-4555-4555-8555-bbbbbbbbbb05', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb01', 'b3333333-4333-4333-8333-bbbbbbbbbb05', '"check_policy"'::jsonb, 4),
  ('b9999999-4555-4555-8555-bbbbbbbbbb06', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb01', 'b3333333-4333-4333-8333-bbbbbbbbbb06', '"1_3h"'::jsonb, 5),
  ('b9999999-4555-4555-8555-bbbbbbbbbb07', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb02', 'b3333333-4333-4333-8333-bbbbbbbbbb01', '"use_as_is"'::jsonb, 0),
  ('b9999999-4555-4555-8555-bbbbbbbbbb08', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb02', 'b3333333-4333-4333-8333-bbbbbbbbbb02', '"check_policy"'::jsonb, 1),
  ('b9999999-4555-4555-8555-bbbbbbbbbb09', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb02', 'b3333333-4333-4333-8333-bbbbbbbbbb03', '"specific_brief"'::jsonb, 2),
  ('b9999999-4555-4555-8555-bbbbbbbbbb0a', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb02', 'b3333333-4333-4333-8333-bbbbbbbbbb04', '"map_first"'::jsonb, 3),
  ('b9999999-4555-4555-8555-bbbbbbbbbb0b', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb02', 'b3333333-4333-4333-8333-bbbbbbbbbb05', '"check_policy"'::jsonb, 4),
  ('b9999999-4555-4555-8555-bbbbbbbbbb0c', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb02', 'b3333333-4333-4333-8333-bbbbbbbbbb06', '"lt_1h"'::jsonb, 5),
  ('b9999999-4555-4555-8555-bbbbbbbbbb0d', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb03', 'b3333333-4333-4333-8333-bbbbbbbbbb01', '"verify_source"'::jsonb, 0),
  ('b9999999-4555-4555-8555-bbbbbbbbbb0e', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb03', 'b3333333-4333-4333-8333-bbbbbbbbbb02', '"check_policy"'::jsonb, 1),
  ('b9999999-4555-4555-8555-bbbbbbbbbb0f', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb03', 'b3333333-4333-4333-8333-bbbbbbbbbb03', '"specific_brief"'::jsonb, 2),
  ('b9999999-4555-4555-8555-bbbbbbbbbb10', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb03', 'b3333333-4333-4333-8333-bbbbbbbbbb04', '"jump_to_ai"'::jsonb, 3),
  ('b9999999-4555-4555-8555-bbbbbbbbbb11', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb03', 'b3333333-4333-4333-8333-bbbbbbbbbb05', '"check_policy"'::jsonb, 4),
  ('b9999999-4555-4555-8555-bbbbbbbbbb12', '22222222-2222-4222-8222-222222222222', 'b8888888-4555-4555-8555-bbbbbbbbbb03', 'b3333333-4333-4333-8333-bbbbbbbbbb06', '"gt_6h"'::jsonb, 5);

COMMIT;
