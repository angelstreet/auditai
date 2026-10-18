import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { applyMigrations, connect } from './db.js';

/**
 * Right-to-erasure (FR-09, ADR 0030). Runs in its own database so it cannot race the
 * isolation suite, which drops the public schema.
 */
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const ACTOR = '99999999-9999-4999-8999-999999999999';
const TARGET = 'synthetic-employee-007'; // tenant A, submission ...aa01 (seed)
const OTHER = 'synthetic-employee-008'; // tenant A, submission ...aa02 (seed)
const INV_TARGET = 'a6666666-6666-4666-8666-66666666660c';
const SUB_TARGET = 'a8888888-4555-4555-8555-aaaaaaaaaa01';
const SUB_OTHER = 'a8888888-4555-4555-8555-aaaaaaaaaa02';
const ANA_TARGET = 'c0000000-0000-4000-8000-000000000001';
const ANA_OTHER = 'c0000000-0000-4000-8000-000000000002';
const ANA_THIRD = 'c0000000-0000-4000-8000-000000000003';

let admin: pg.Client;
let db: pg.Client;

const asService = async (sql: string, params: unknown[] = []) => {
  await db.query('BEGIN');
  try {
    await db.query(`SELECT set_config('app.is_service_account','on',true)`);
    const r = await db.query(sql, params);
    await db.query('COMMIT');
    return r;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
};

const erase = async (tenant: string, pseudonym: string, scope = 'respondent_pseudonym') => {
  await db.query('BEGIN');
  await db.query(`SELECT set_config('app.tenant_id',$1,true)`, [tenant]);
  const r = await db.query(`SELECT erase_respondent_pseudonym($1,$2,$3,$4) AS r`, [
    tenant,
    pseudonym,
    ACTOR,
    scope,
  ]);
  await db.query('COMMIT');
  return r.rows[0].r as Record<string, unknown>;
};

beforeAll(async () => {
  admin = connect();
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS erasure_test');
  await admin.query('CREATE DATABASE erasure_test');
  const url = new URL(process.env['DATABASE_URL'] as string);
  url.pathname = '/erasure_test';
  db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  await applyMigrations(db);
  await db.query('SET ROLE auditai_app');

  const ana = (id: string, sub: string) =>
    asService(
      `INSERT INTO analyses (id, tenant_id, engagement_id, submission_id, sensitivity, payload_json, model_route)
       VALUES ($1,$2,'a5555555-4555-4555-8555-555555555555',$3,'internal','{"t":"x"}','rule-based/v1')`,
      [id, TENANT_A, sub],
    );
  await ana(ANA_TARGET, SUB_TARGET);
  await ana(ANA_OTHER, SUB_OTHER);
  await ana(ANA_THIRD, 'a8888888-4555-4555-8555-aaaaaaaaaa03');
  await asService(
    `INSERT INTO opportunities (tenant_id, engagement_id, analysis_id, status, title, created_by)
     VALUES ($1,'a5555555-4555-4555-8555-555555555555',$2,'draft','Draft from target',$4),
            ($1,'a5555555-4555-4555-8555-555555555555',$2,'approved','Approved from target',$4),
            ($1,'a5555555-4555-4555-8555-555555555555',$3,'draft','Draft from other',$4)`,
    [TENANT_A, ANA_TARGET, ANA_OTHER, ACTOR],
  );
  // One synergy on {target, other, third} (survives trimmed), one on {target, other} (deleted).
  const syn = (key: string, ids: string[]) =>
    asService(
      `INSERT INTO synergies (tenant_id, axis, theme_label, synergy_key, source_analysis_ids,
         source_engagement_ids, occurrence_count, proposed_followup_prompt)
       VALUES ($1,'literacy',$2,$2,$3::jsonb,'["a5555555-4555-4555-8555-555555555555"]',$4,'follow up')`,
      [TENANT_A, key, JSON.stringify(ids), ids.length],
    );
  await syn('three', [ANA_TARGET, ANA_OTHER, ANA_THIRD]);
  await syn('two', [ANA_TARGET, ANA_OTHER]);
  await asService(
    `INSERT INTO respondent_badges (tenant_id, respondent_pseudonym, quiz_score, mascot_tier)
     VALUES ($1,$2,50,'fox')`,
    [TENANT_A, TARGET],
  );
}, 120_000);

afterAll(async () => {
  await db.end();
  await admin.query('DROP DATABASE IF EXISTS erasure_test');
  await admin.end();
});

const countAll = async (needle: string, tenant = TENANT_A): Promise<Record<string, number>> => {
  const tables = await asService(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'`,
  );
  const hits: Record<string, number> = {};
  for (const { table_name } of tables.rows as { table_name: string }[]) {
    const r = await asService(
      `SELECT count(*)::int n FROM "${table_name}" t WHERE t::text LIKE $1 AND to_jsonb(t)->>'tenant_id' = $2`,
      [`%${needle}%`, tenant],
    );
    if (r.rows[0].n > 0) hits[table_name] = r.rows[0].n;
  }
  return hits;
};

describe('erase_respondent_pseudonym', () => {
  it('starts with the pseudonym present', async () => {
    const hits = await countAll(TARGET);
    expect(hits['invitations']).toBe(1);
    expect(hits['respondent_badges']).toBe(1);
  });

  it('leaves no row in any table carrying the pseudonym, and trails hold only a hash', async () => {
    const before = {
      other: (await countAll(OTHER))['invitations'],
      answersOther: (
        await asService(`SELECT count(*)::int n FROM answers WHERE submission_id=$1`, [SUB_OTHER])
      ).rows[0].n,
    };
    const res = await erase(TENANT_A, TARGET);
    expect(res['invitation']).toBe(1);
    expect(res['submission']).toBe(1);
    expect(res['answer']).toBe(6);
    expect(res['analysis']).toBe(1);
    expect(res['opportunity']).toBe(1);
    expect(res['synergy']).toBe(1);

    expect(await countAll(TARGET)).toEqual({});
    // Same pseudonym string in another tenant is a different person: untouched.
    expect((await countAll(TARGET, TENANT_B))['invitations']).toBe(1);
    for (const id of [INV_TARGET, SUB_TARGET, ANA_TARGET]) {
      expect(await countAll(id)).not.toHaveProperty('submissions');
    }
    // Other pseudonym untouched.
    expect((await countAll(OTHER))['invitations']).toBe(before.other);
    const a = await asService(`SELECT count(*)::int n FROM answers WHERE submission_id=$1`, [
      SUB_OTHER,
    ]);
    expect(a.rows[0].n).toBe(before.answersOther);
    const ids = await asService(`SELECT id FROM analyses WHERE id = ANY($1)`, [
      [ANA_TARGET, ANA_OTHER, ANA_THIRD],
    ]);
    expect(ids.rows.map((r) => r.id).sort()).toEqual([ANA_OTHER, ANA_THIRD]);
  });

  it('keeps reviewed opportunities (link nulled), trims aggregates, deletes thin ones', async () => {
    const opp = await asService(`SELECT title, analysis_id FROM opportunities ORDER BY title`);
    expect(opp.rows).toEqual([
      { title: 'Approved from target', analysis_id: null },
      { title: 'Draft from other', analysis_id: ANA_OTHER },
    ]);
    const syn = await asService(
      `SELECT synergy_key, occurrence_count, source_analysis_ids FROM synergies`,
    );
    expect(syn.rows).toHaveLength(1);
    expect(syn.rows[0].synergy_key).toBe('three');
    expect(syn.rows[0].occurrence_count).toBe(2);
    expect(syn.rows[0].source_analysis_ids).toEqual([ANA_OTHER, ANA_THIRD]);
  });

  it('writes one deletion_events row per kind and one audit_log row', async () => {
    const ev = await asService(
      `SELECT target_kind, row_count, respondent_pseudonym FROM deletion_events WHERE scope='respondent_pseudonym'`,
    );
    const kinds = ev.rows.map((r) => r.target_kind).sort();
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds).toEqual(
      expect.arrayContaining([
        'invitation',
        'submission',
        'answer',
        'analysis',
        'respondent_badge',
      ]),
    );
    for (const r of ev.rows) expect(r.respondent_pseudonym).toMatch(/^[0-9a-f]{64}$/);
    const au = await asService(`SELECT payload_json FROM audit_log WHERE action='pseudonym.erase'`);
    expect(au.rows).toHaveLength(1);
  });

  it('is idempotent and writes no events for an unknown pseudonym', async () => {
    const res = await erase(TENANT_A, TARGET);
    expect(res['invitation']).toBe(0);
    const au = await asService(
      `SELECT count(*)::int n FROM audit_log WHERE action='pseudonym.erase'`,
    );
    expect(au.rows[0].n).toBe(1);
  });

  it('does not cross tenants: erasing in tenant B leaves tenant A rows', async () => {
    expect((await countAll(OTHER, TENANT_B))['invitations']).toBe(1);
    const res = await erase(TENANT_B, OTHER);
    expect(res['invitation']).toBe(1);
    expect(await countAll(OTHER, TENANT_B)).toEqual({});
    expect((await countAll(OTHER, TENANT_A))['invitations']).toBe(1);
    // Tenant B's same-named pseudonym in the earlier erase was never touched until now.
  });

  it('restores the service-account flag after the call', async () => {
    await db.query('BEGIN');
    await db.query(`SELECT erase_respondent_pseudonym($1,$2,$3,'respondent_pseudonym')`, [
      TENANT_A,
      'nobody-here-1',
      ACTOR,
    ]);
    const f = await db.query(
      `SELECT coalesce(current_setting('app.is_service_account', true),'') AS f`,
    );
    await db.query('ROLLBACK');
    expect(f.rows[0].f).not.toBe('on');
  });
});
