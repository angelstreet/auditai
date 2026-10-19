import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { applyMigrations, connect, withServiceAccount, withTenant } from './db.js';

/**
 * TASK-V (ADR 0041): tenant isolation and write rules of the audit report tables. The app role
 * sees only its tenant's reports, steps and published versions, cannot delete any of them, and
 * cannot rewrite a published snapshot (only the unpublish columns change).
 */
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const ENG_A = 'a5555555-4555-4555-8555-555555555555';
const ENG_B = 'b5555555-4555-4555-8555-555555555555';
const AUDITOR = '99999999-9999-4999-8999-999999999999';

let admin: pg.Client;
let client: pg.Client;
const ids: Record<string, string> = {};

beforeAll(async () => {
  admin = connect();
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS audit_reports_test');
  await admin.query('CREATE DATABASE audit_reports_test');
  const url = new URL(process.env['DATABASE_URL'] as string);
  url.pathname = '/audit_reports_test';
  client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  await applyMigrations(client);
  await client.query('SET ROLE auditai_app');
  await withServiceAccount(client, async () => {
    for (const [tenant, eng] of [
      [TENANT_A, ENG_A],
      [TENANT_B, ENG_B],
    ] as const) {
      const r = await client.query<{ id: string }>(
        `INSERT INTO audit_reports (tenant_id, engagement_id, locale, title, catalogue_version, created_by)
         VALUES ($1, $2, 'en', 'Demo report', '2026-10-19.1', $3) RETURNING id`,
        [tenant, eng, AUDITOR],
      );
      ids[`report_${tenant}`] = r.rows[0]?.id as string;
      const o = await client.query<{ id: string }>(
        `INSERT INTO opportunities (tenant_id, engagement_id, status, title, created_by)
         VALUES ($1, $2, 'approved', 'Demo opportunity', $3) RETURNING id`,
        [tenant, eng, AUDITOR],
      );
      ids[`opp_${tenant}`] = o.rows[0]?.id as string;
      await client.query(
        `INSERT INTO report_steps (tenant_id, report_id, opportunity_id, catalogue_id, source, category,
                                   title, effort, impact, risk, horizon)
         VALUES ($1, $2, $3, 'train.ai_basics', 'rule', 'train', 'AI basics', 'low', 'medium', 'low', 'd30')`,
        [tenant, ids[`report_${tenant}`], ids[`opp_${tenant}`]],
      );
      const v = await client.query<{ id: string }>(
        `INSERT INTO audit_report_versions (tenant_id, report_id, engagement_id, version, snapshot_json, published_by)
         VALUES ($1, $2, $3, 1, '{"summary":"x"}', $4) RETURNING id`,
        [tenant, ids[`report_${tenant}`], eng, AUDITOR],
      );
      ids[`version_${tenant}`] = v.rows[0]?.id as string;
    }
  });
});

afterAll(async () => {
  await client.end();
  await admin.query('DROP DATABASE IF EXISTS audit_reports_test');
  await admin.end();
});

describe('audit report isolation', () => {
  it('each tenant sees only its own report, steps and versions', async () => {
    for (const [tenant, other] of [
      [TENANT_A, TENANT_B],
      [TENANT_B, TENANT_A],
    ] as const) {
      const seen = await withTenant(client, tenant, async () => ({
        reports: (await client.query('SELECT tenant_id FROM audit_reports')).rows,
        steps: (await client.query('SELECT tenant_id FROM report_steps')).rows,
        versions: (await client.query('SELECT tenant_id FROM audit_report_versions')).rows,
      }));
      for (const rows of Object.values(seen)) {
        expect(rows).toHaveLength(1);
        expect(rows.every((r) => r.tenant_id === tenant)).toBe(true);
        expect(rows.some((r) => r.tenant_id === other)).toBe(false);
      }
    }
  });

  it('a guessed id from another tenant returns nothing and updates nothing', async () => {
    const res = await withTenant(client, TENANT_A, async () => ({
      read: (
        await client.query('SELECT id FROM audit_reports WHERE id = $1', [
          ids[`report_${TENANT_B}`],
        ])
      ).rows,
      update: await client.query(`UPDATE audit_reports SET summary = 'hijack' WHERE id = $1`, [
        ids[`report_${TENANT_B}`],
      ]),
      unpublish: await client.query(
        'UPDATE audit_report_versions SET unpublished_at = now() WHERE id = $1',
        [ids[`version_${TENANT_B}`]],
      ),
    }));
    expect(res.read).toHaveLength(0);
    expect(res.update.rowCount).toBe(0);
    expect(res.unpublish.rowCount).toBe(0);
  });

  it('refuses to insert a row for another tenant', async () => {
    await expect(
      withTenant(client, TENANT_A, () =>
        client.query(
          `INSERT INTO audit_reports (tenant_id, engagement_id, locale, title, catalogue_version, created_by)
           VALUES ($1, $2, 'en', 'x', 'v', $3)`,
          [TENANT_B, ENG_B, AUDITOR],
        ),
      ),
    ).rejects.toThrow();
  });

  it('cannot delete reports, steps or versions, nor rewrite a published snapshot', async () => {
    for (const sql of [
      'DELETE FROM audit_reports',
      'DELETE FROM report_steps',
      'DELETE FROM audit_report_versions',
      `UPDATE audit_report_versions SET snapshot_json = '{}'`,
    ]) {
      await expect(
        withTenant(client, TENANT_A, () => client.query(sql)),
        sql,
      ).rejects.toThrow(/permission denied/);
    }
  });

  it('can unpublish its own version and log every report verb', async () => {
    const out = await withTenant(client, TENANT_A, async () => {
      const u = await client.query(
        'UPDATE audit_report_versions SET unpublished_at = now(), unpublished_by = $2 WHERE id = $1',
        [ids[`version_${TENANT_A}`], AUDITOR],
      );
      for (const action of ['report.publish', 'report.unpublish', 'report_step.accept']) {
        await client.query(
          `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            TENANT_A,
            AUDITOR,
            action,
            action.startsWith('report_step') ? 'report_step' : 'report',
            ids[`report_${TENANT_A}`],
          ],
        );
      }
      return u.rowCount;
    });
    expect(out).toBe(1);
  });

  it('keeps one working report per engagement and one step per catalogue entry', async () => {
    await expect(
      withTenant(client, TENANT_A, () =>
        client.query(
          `INSERT INTO audit_reports (tenant_id, engagement_id, locale, title, catalogue_version, created_by)
           VALUES ($1, $2, 'en', 'Again', 'v', $3)`,
          [TENANT_A, ENG_A, AUDITOR],
        ),
      ),
    ).rejects.toThrow(/duplicate key/);
    await expect(
      withTenant(client, TENANT_A, () =>
        client.query(
          `INSERT INTO report_steps (tenant_id, report_id, opportunity_id, catalogue_id, source, category,
                                     title, effort, impact, risk, horizon)
           VALUES ($1, $2, $3, 'train.ai_basics', 'rule', 'train', 'Again', 'low', 'low', 'low', 'd30')`,
          [TENANT_A, ids[`report_${TENANT_A}`], ids[`opp_${TENANT_A}`]],
        ),
      ),
    ).rejects.toThrow(/duplicate key/);
  });
});
