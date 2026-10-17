-- 0014_erase_pseudonym.sql
--
-- TASK-B (FR-09, PRD §15, ADR 0020): real right-to-erasure.
--
-- One SQL function, `erase_respondent_pseudonym`, removes every row that
-- carries a pseudonym or is derived from it, inside the caller's
-- transaction. The web action and the retention worker both call it.
-- The append-only trails (`audit_log`, `deletion_events`) never store the
-- raw pseudonym: they store sha256(tenant_id || ':' || pseudonym).

BEGIN;

SET LOCAL app.is_service_account = 'on';

ALTER TABLE deletion_events
  ADD COLUMN row_count INTEGER NOT NULL DEFAULT 1 CHECK (row_count >= 0);

ALTER TABLE deletion_events DROP CONSTRAINT IF EXISTS deletion_events_target_kind_check;
ALTER TABLE deletion_events
  ADD CONSTRAINT deletion_events_target_kind_check CHECK (target_kind IN (
      'respondent_badge', 'synergy', 'opportunity', 'analysis', 'audit_log', 'export_request',
      'invitation', 'respondent', 'submission', 'answer'
    ));

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_action_check CHECK (action IN (
      'analysis.approve', 'analysis.reject',
      'opportunity.create', 'opportunity.update', 'opportunity.archive',
      'synergy.detect', 'synergy.surface', 'synergy.dismiss', 'synergy.archive',
      'export.complete', 'badge.erase', 'pseudonym.erase'
    ));

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_target_kind_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_kind_check CHECK (target_kind IN (
      'analysis', 'opportunity', 'synergy', 'respondent_badge', 'export_request', 'invitation'
    ));

-- Actor for scheduled erasures (audit_log.actor_user_id and deletion_events.requested_by are FKs).
INSERT INTO users (id, email_hash, display_name)
VALUES ('00000000-0000-4000-8000-000000000000', 'system:retention-worker', 'System (retention worker)')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION erase_respondent_pseudonym(
  p_tenant_id UUID,
  p_pseudonym TEXT,
  p_actor     UUID,
  p_scope     TEXT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  prev_flag   TEXT := current_setting('app.is_service_account', true);
  v_hash      TEXT := encode(sha256(convert_to(p_tenant_id::text || ':' || p_pseudonym, 'UTF8')), 'hex');
  inv_ids     UUID[];
  sub_ids     UUID[];
  ana_ids     UUID[];
  badge_ids   UUID[];
  opp_ids     UUID[];
  syn_ids     UUID[];
  trimmed_ids UUID[];
  n_answers   INTEGER;
  n_resp      INTEGER;
  syn_trimmed INTEGER := 0;
  counts      JSONB := '{}'::jsonb;
  audit_id    UUID;
  anchor_id   UUID;
  k           TEXT;
  v           INTEGER;
BEGIN
  IF p_scope NOT IN ('respondent_pseudonym', 'retention_expired') THEN
    RAISE EXCEPTION 'unsupported erase scope %', p_scope;
  END IF;
  -- DELETE policies are service-account only; the flag is restored on exit.
  PERFORM set_config('app.is_service_account', 'on', true);

  SELECT coalesce(array_agg(id), '{}') INTO inv_ids
    FROM invitations WHERE tenant_id = p_tenant_id AND respondent_pseudonym = p_pseudonym;
  SELECT coalesce(array_agg(id), '{}') INTO sub_ids
    FROM submissions WHERE tenant_id = p_tenant_id AND invitation_id = ANY (inv_ids);
  SELECT coalesce(array_agg(id), '{}') INTO ana_ids
    FROM analyses WHERE tenant_id = p_tenant_id AND submission_id = ANY (sub_ids);
  SELECT coalesce(array_agg(id), '{}') INTO badge_ids
    FROM respondent_badges WHERE tenant_id = p_tenant_id AND respondent_pseudonym = p_pseudonym;
  SELECT count(*) INTO n_answers FROM answers
    WHERE tenant_id = p_tenant_id AND submission_id = ANY (sub_ids);
  SELECT count(*) INTO n_resp FROM respondents
    WHERE tenant_id = p_tenant_id AND (pseudonym = p_pseudonym OR invitation_id = ANY (inv_ids));

  -- Draft opportunities that came from an erased analysis are derived text: delete.
  -- Reviewed (non-draft) opportunities are kept; analysis_id is nulled by the FK.
  SELECT coalesce(array_agg(id), '{}') INTO opp_ids FROM opportunities
    WHERE tenant_id = p_tenant_id AND status = 'draft' AND analysis_id = ANY (ana_ids);
  DELETE FROM opportunities WHERE id = ANY (opp_ids);

  -- Synergies: aggregate across analyses. Drop erased analysis ids; delete when < 2 remain.
  WITH t AS (
    UPDATE synergies s SET
        source_analysis_ids = (
          SELECT coalesce(jsonb_agg(e), '[]'::jsonb)
            FROM jsonb_array_elements(s.source_analysis_ids) e
           WHERE NOT ((e #>> '{}')::uuid = ANY (ana_ids))),
        updated_at = now()
      WHERE s.tenant_id = p_tenant_id
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(s.source_analysis_ids) e
                     WHERE (e #>> '{}')::uuid = ANY (ana_ids))
      RETURNING s.id)
  SELECT coalesce(array_agg(id), '{}') INTO trimmed_ids FROM t;
  syn_trimmed := cardinality(trimmed_ids);
  SELECT coalesce(array_agg(id), '{}') INTO syn_ids FROM synergies
    WHERE id = ANY (trimmed_ids) AND jsonb_array_length(source_analysis_ids) < 2;
  DELETE FROM synergies WHERE id = ANY (syn_ids);
  UPDATE synergies SET occurrence_count = jsonb_array_length(source_analysis_ids)
    WHERE id = ANY (trimmed_ids) AND id <> ALL (syn_ids);

  DELETE FROM analyses WHERE id = ANY (ana_ids);
  DELETE FROM respondent_badges WHERE id = ANY (badge_ids);
  -- Deleting invitations cascades to respondents, submissions and answers.
  DELETE FROM invitations WHERE id = ANY (inv_ids);

  counts := jsonb_build_object(
    'invitation', cardinality(inv_ids), 'respondent', n_resp,
    'submission', cardinality(sub_ids), 'answer', n_answers,
    'analysis', cardinality(ana_ids), 'opportunity', cardinality(opp_ids),
    'synergy', cardinality(syn_ids), 'respondent_badge', cardinality(badge_ids));

  anchor_id := coalesce(inv_ids[1], badge_ids[1]);
  IF anchor_id IS NOT NULL THEN
    INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
    VALUES (p_tenant_id, p_actor, 'pseudonym.erase',
            CASE WHEN inv_ids[1] IS NOT NULL THEN 'invitation' ELSE 'respondent_badge' END,
            anchor_id,
            jsonb_build_object('pseudonym_hash', v_hash, 'scope', p_scope,
                               'synergies_trimmed', syn_trimmed, 'removed', counts))
    RETURNING id INTO audit_id;
    FOR k, v IN SELECT key, value::int FROM jsonb_each_text(counts) LOOP
      CONTINUE WHEN v = 0;
      INSERT INTO deletion_events (tenant_id, requested_by, scope, respondent_pseudonym,
                                   target_kind, target_id, audit_log_id, row_count)
      VALUES (p_tenant_id, p_actor, p_scope, v_hash, k,
              CASE k WHEN 'invitation' THEN inv_ids[1] WHEN 'respondent_badge' THEN badge_ids[1]
                     WHEN 'submission' THEN sub_ids[1] WHEN 'analysis' THEN ana_ids[1]
                     WHEN 'opportunity' THEN opp_ids[1] WHEN 'synergy' THEN syn_ids[1] END,
              audit_id, v);
    END LOOP;
  END IF;

  PERFORM set_config('app.is_service_account', coalesce(prev_flag, ''), true);
  RETURN counts || jsonb_build_object('pseudonym_hash', v_hash);
END;
$$;

GRANT EXECUTE ON FUNCTION erase_respondent_pseudonym(UUID, TEXT, UUID, TEXT) TO auditai_app;

COMMIT;
