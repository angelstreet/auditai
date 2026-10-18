import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const runReminderPass = vi.fn(async () => ({ sent: 0, listed: 0, purged: 0 }));
vi.mock('@/lib/invitationDelivery', () => ({ runReminderPass }));

const call = async (authorization?: string) => {
  const { GET } = await import('./route');
  const headers: Record<string, string> = { host: 'example.invalid' };
  if (authorization) headers['authorization'] = authorization;
  return GET(new NextRequest('https://example.invalid/api/cron/reminders', { headers }));
};

describe('reminder cron route authorisation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    runReminderPass.mockClear();
  });

  it('answers 401 with no header, and never runs the pass', async () => {
    vi.stubEnv('CRON_SECRET', 'a-synthetic-test-secret-0123456789');
    expect((await call()).status).toBe(401);
    expect(runReminderPass).not.toHaveBeenCalled();
  });

  it('answers 401 for a wrong secret', async () => {
    vi.stubEnv('CRON_SECRET', 'a-synthetic-test-secret-0123456789');
    expect((await call('Bearer wrong')).status).toBe(401);
    expect(runReminderPass).not.toHaveBeenCalled();
  });

  it('fails closed when the secret is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await call('Bearer ')).status).toBe(401);
    expect(runReminderPass).not.toHaveBeenCalled();
  });

  it('runs the pass with the right bearer token', async () => {
    vi.stubEnv('CRON_SECRET', 'a-synthetic-test-secret-0123456789');
    const res = await call('Bearer a-synthetic-test-secret-0123456789');
    expect(res.status).toBe(200);
    expect(runReminderPass).toHaveBeenCalledTimes(1);
  });
});
