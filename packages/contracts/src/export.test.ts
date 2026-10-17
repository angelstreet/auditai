import { describe, expect, it } from 'vitest';
import {
  exportKindSchema,
  exportRequestSchema,
  exportRequestWriteSchema,
  exportStatusSchema,
} from './export.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const USER = '99999999-9999-4999-8999-999999999999';
const ID = 'e0000000-0000-4000-8000-000000000001';

describe('export trail (M15, FR-09)', () => {
  it('exposes the canonical kind + status enums', () => {
    expect(exportKindSchema.options).toEqual([
      'opportunities',
      'analyses',
      'respondent_badges',
      'team_badges',
      'synergies',
      'audit_log',
    ]);
    expect(exportStatusSchema.options).toEqual(['pending', 'completed', 'failed']);
  });

  it('parses a full export request row', () => {
    const row = exportRequestSchema.parse({
      id: ID,
      tenantId: TENANT,
      requestedBy: USER,
      kind: 'opportunities',
      status: 'completed',
      rowCount: 12,
      error: null,
      createdAt: '2026-10-17T10:00:00.000Z',
      completedAt: '2026-10-17T10:00:01.000Z',
    });
    expect(row.rowCount).toBe(12);
    expect(row.kind).toBe('opportunities');
  });

  it('write schema omits the row count + timestamps', () => {
    const row = exportRequestWriteSchema.parse({
      tenantId: TENANT,
      requestedBy: USER,
      kind: 'audit_log',
    });
    expect(Object.keys(row)).toEqual(expect.arrayContaining(['tenantId', 'requestedBy', 'kind']));
    expect(Object.keys(row)).not.toContain('rowCount');
    expect(Object.keys(row)).not.toContain('createdAt');
  });

  it('rejects a negative row count', () => {
    const result = exportRequestSchema.safeParse({
      id: ID,
      tenantId: TENANT,
      requestedBy: USER,
      kind: 'opportunities',
      status: 'completed',
      rowCount: -1,
      error: null,
      createdAt: '2026-10-17T10:00:00.000Z',
      completedAt: '2026-10-17T10:00:01.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown export kind', () => {
    const result = exportRequestSchema.safeParse({
      id: ID,
      tenantId: TENANT,
      requestedBy: USER,
      kind: 'secret_company_data',
      status: 'pending',
      rowCount: 0,
      error: null,
      createdAt: '2026-10-17T10:00:00.000Z',
      completedAt: null,
    });
    expect(result.success).toBe(false);
  });
});
