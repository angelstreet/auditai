import { describe, expect, it } from 'vitest';
import {
  redactionTermSchema,
  redactionTermWriteSchema,
  redactionTermRemoveSchema,
} from './redactionTerm.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ROW = '20000000-0000-4000-8000-000000000001';

describe('redaction term schema (TASK-Q, Gate B, ADR 0035)', () => {
  it('parses a complete row', () => {
    const row = redactionTermSchema.parse({
      id: ROW,
      tenantId: TENANT,
      term: 'Project Northstar',
      createdAt: '2026-10-18T10:00:00.000Z',
    });
    expect(row.term).toBe('Project Northstar');
  });

  it('write shape trims whitespace and enforces the length window', () => {
    const parsed = redactionTermWriteSchema.parse({
      tenantId: TENANT,
      term: '  Project Northstar  ',
    });
    // Trim happens at the schema level so the data layer does not need to re-do it.
    expect(parsed.term).toBe('Project Northstar');
  });

  it('rejects a too-short term', () => {
    const result = redactionTermWriteSchema.safeParse({ tenantId: TENANT, term: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejects a too-long term', () => {
    const result = redactionTermWriteSchema.safeParse({
      tenantId: TENANT,
      term: 'x'.repeat(120),
    });
    expect(result.success).toBe(false);
  });

  it('remove shape needs a row id', () => {
    const ok = redactionTermRemoveSchema.safeParse({ tenantId: TENANT, termId: ROW });
    expect(ok.success).toBe(true);
    const bad = redactionTermRemoveSchema.safeParse({ tenantId: TENANT, termId: 'not-a-uuid' });
    expect(bad.success).toBe(false);
  });
});
