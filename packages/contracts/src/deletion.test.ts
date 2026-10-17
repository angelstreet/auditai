import { describe, expect, it } from 'vitest';
import {
  deletionEventSchema,
  deletionRequestSchema,
  deletionScopeSchema,
  deletionTargetKindSchema,
} from './deletion.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const USER = '99999999-9999-4999-8999-999999999999';
const PSEUDONYM = 'synthetic-employee-001';
const ID = 'd0000000-0000-4000-8000-000000000001';
const TARGET_ID = 'a3333333-3333-4333-8333-333333333333';

describe('deletion trail (M15, FR-09)', () => {
  it('exposes the canonical scope + target kind enums', () => {
    expect(deletionScopeSchema.options).toEqual([
      'respondent_pseudonym',
      'retention_expired',
      'engagement',
      'tenant',
    ]);
    expect(deletionTargetKindSchema.options).toEqual([
      'respondent_badge',
      'synergy',
      'opportunity',
      'analysis',
      'audit_log',
      'export_request',
    ]);
  });

  it('parses a deletion event with a pseudonym + audit_log link', () => {
    const event = deletionEventSchema.parse({
      id: ID,
      tenantId: TENANT,
      requestedBy: USER,
      scope: 'respondent_pseudonym',
      respondentPseudonym: PSEUDONYM,
      targetKind: 'respondent_badge',
      targetId: TARGET_ID,
      auditLogId: '00000000-0000-4000-8000-000000000099',
      createdAt: '2026-10-17T10:00:00.000Z',
    });
    expect(event.respondentPseudonym).toBe(PSEUDONYM);
    expect(event.targetKind).toBe('respondent_badge');
  });

  it('allows retention_expired scope with a null pseudonym + target_id', () => {
    const event = deletionEventSchema.parse({
      id: ID,
      tenantId: TENANT,
      requestedBy: USER,
      scope: 'retention_expired',
      respondentPseudonym: null,
      targetKind: 'respondent_badge',
      targetId: null,
      auditLogId: null,
      createdAt: '2026-10-17T10:00:00.000Z',
    });
    expect(event.scope).toBe('retention_expired');
  });

  it('right-to-erasure request shape carries the pseudonym', () => {
    const req = deletionRequestSchema.parse({
      tenantId: TENANT,
      requestedBy: USER,
      scope: 'respondent_pseudonym',
      respondentPseudonym: PSEUDONYM,
    });
    expect(req.scope).toBe('respondent_pseudonym');
    expect(req.respondentPseudonym).toBe(PSEUDONYM);
  });

  it('refuses a too-short pseudonym', () => {
    const result = deletionRequestSchema.safeParse({
      tenantId: TENANT,
      requestedBy: USER,
      scope: 'respondent_pseudonym',
      respondentPseudonym: 'x',
    });
    expect(result.success).toBe(false);
  });
});
