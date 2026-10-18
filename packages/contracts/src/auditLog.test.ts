import { describe, expect, it } from 'vitest';
import {
  analysisAuditLogSchema,
  auditActionSchema,
  auditLogSchema,
  auditLogWriteSchema,
  auditTargetKindSchema,
  opportunityAuditLogSchema,
  synergyAuditLogSchema,
} from './auditLog.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const USER = '99999999-9999-4999-8999-999999999999';
const ENG = 'a5555555-4555-4555-8555-555555555555';
const ANALYSIS = 'b0000000-0000-4000-8000-000000000001';
const OPPORTUNITY = 'c0000000-0000-4000-8000-000000000001';
const SYNERGY = '10000000-0000-4000-8000-000000000001';
const AUDIT_ID = 'd0000000-0000-4000-8000-000000000001';

describe('audit log schema (M10, FR-08, PRD §25.4)', () => {
  it('exposes the canonical action and target kinds', () => {
    expect(auditActionSchema.options).toEqual([
      'analysis.approve',
      'analysis.reject',
      'opportunity.create',
      'opportunity.update',
      'opportunity.archive',
      'synergy.detect',
      'synergy.surface',
      'synergy.dismiss',
      'synergy.archive',
      'export.complete',
      'badge.erase',
      'pseudonym.erase',
      'user.create',
      'user.set_password',
      'user.disable',
    ]);
    expect(auditTargetKindSchema.options).toEqual([
      'analysis',
      'opportunity',
      'synergy',
      'respondent_badge',
      'export_request',
      'invitation',
      'user',
    ]);
  });

  it('parses a complete audit log row', () => {
    const row = auditLogSchema.parse({
      id: AUDIT_ID,
      tenantId: TENANT,
      actorUserId: USER,
      action: 'analysis.approve',
      targetKind: 'analysis',
      targetId: ANALYSIS,
      payload: { modelRoute: 'rule-based/v1', engagementId: ENG },
      createdAt: '2026-10-15T06:00:00.000Z',
    });
    expect(row.action).toBe('analysis.approve');
    expect(row.payload['modelRoute']).toBe('rule-based/v1');
  });

  it('analysis audit log refines targetId to AnalysisId', () => {
    const row = analysisAuditLogSchema.parse({
      id: AUDIT_ID,
      tenantId: TENANT,
      actorUserId: USER,
      action: 'analysis.approve',
      targetKind: 'analysis',
      targetId: ANALYSIS,
      payload: {},
      createdAt: '2026-10-15T06:00:00.000Z',
    });
    // The schema tags the targetId as AnalysisId at the type level; at runtime it is a string.
    expect(row.targetId).toBe(ANALYSIS);
  });

  it('opportunity audit log refines targetId to OpportunityId', () => {
    const row = opportunityAuditLogSchema.parse({
      id: AUDIT_ID,
      tenantId: TENANT,
      actorUserId: USER,
      action: 'opportunity.create',
      targetKind: 'opportunity',
      targetId: OPPORTUNITY,
      payload: { title: 'Brief automation' },
      createdAt: '2026-10-15T06:00:00.000Z',
    });
    expect(row.targetId).toBe(OPPORTUNITY);
  });

  it('synergy audit log refines targetId to SynergyId and accepts synergy.detect', () => {
    const row = synergyAuditLogSchema.parse({
      id: AUDIT_ID,
      tenantId: TENANT,
      actorUserId: USER,
      action: 'synergy.detect',
      targetKind: 'synergy',
      targetId: SYNERGY,
      payload: {
        themeLabel: 'Source-checking practice',
        engagements: 2,
      },
      createdAt: '2026-10-17T10:00:00.000Z',
    });
    expect(row.action).toBe('synergy.detect');
    expect(row.targetId).toBe(SYNERGY);
  });

  it('rejects an unknown action verb', () => {
    const result = auditLogSchema.safeParse({
      id: AUDIT_ID,
      tenantId: TENANT,
      actorUserId: USER,
      action: 'analysis.typo',
      targetKind: 'analysis',
      targetId: ANALYSIS,
      payload: {},
      createdAt: '2026-10-15T06:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('write request omits id and createdAt', () => {
    const result = auditLogWriteSchema.safeParse({
      actorUserId: USER,
      action: 'analysis.approve',
      targetKind: 'analysis',
      targetId: ANALYSIS,
      payload: { engagementId: ENG },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // `id` and `createdAt` are intentionally absent on the write shape.
      expect(Object.keys(result.data)).not.toContain('id');
      expect(Object.keys(result.data)).not.toContain('createdAt');
    }
  });

  it('rejects a write request with a malformed actor id', () => {
    const result = auditLogWriteSchema.safeParse({
      actorUserId: 'not-a-uuid',
      action: 'analysis.approve',
      targetKind: 'analysis',
      targetId: ANALYSIS,
    });
    expect(result.success).toBe(false);
  });
});
