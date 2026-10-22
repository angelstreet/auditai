import { describe, expect, it, vi } from 'vitest';
import type { SessionPayload } from './session';

vi.mock('./db', () => ({ withTenant: vi.fn() }));

const { mayReadAnswers } = await import('./answersExport');

/** TASK-AD2: the answers are for EvolAI staff only, never a referent or view-as. */
const T = '11111111-1111-4111-8111-111111111111';
const session = (role: string, extra: Partial<SessionPayload> = {}): SessionPayload =>
  ({ sub: 'u1', name: 'Demo', email: null, tenants: [{ id: T, role }], ...extra }) as never;

describe('mayReadAnswers', () => {
  it('lets staff of that organisation read them', () => {
    expect(mayReadAnswers(session('auditor'), T)).toBe(true);
    expect(mayReadAnswers(session('platform_owner'), T)).toBe(true);
  });
  it('refuses a referent, view-as, another organisation and no session', () => {
    expect(mayReadAnswers(session('team_referent'), T)).toBe(false);
    expect(
      mayReadAnswers(
        session('platform_owner', { viewAs: { tenantId: T, userId: 'r1' } } as never),
        T,
      ),
    ).toBe(false);
    expect(mayReadAnswers(session('auditor'), '22222222-2222-4222-8222-222222222222')).toBe(false);
    expect(mayReadAnswers(null, T)).toBe(false);
  });
});
