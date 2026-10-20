import { describe, expect, it } from 'vitest';
import {
  MIN_GROUP_SIZE,
  applyMinGroup,
  csvCell,
  engagementTotals,
  invitationNumbers,
  isReminderDue,
  parseReminderDays,
  resolveBaseUrl,
  surveyLink,
  toCsv,
  type TeamCounts,
} from './invitationTracking';

const team = (over: Partial<TeamCounts>): TeamCounts => ({
  teamId: 't',
  teamName: 'Team',
  invited: 10,
  opened: 6,
  started: 4,
  completed: 3,
  lastActivityOn: '2026-10-10',
  ...over,
});

describe('minimum group size', () => {
  it('suppresses every number but the invitation total below 5', () => {
    const [row] = applyMinGroup([team({ invited: MIN_GROUP_SIZE - 1, completed: 2 })]);
    expect(row).toEqual({ suppressed: true, teamId: 't', teamName: 'Team', invited: 4 });
    expect(JSON.stringify(row)).not.toMatch(/completed|opened|started|lastActivity/);
  });
  it('shows counts, rate and activity day at 5 and above', () => {
    const [row] = applyMinGroup([team({ invited: 5, completed: 2 })]);
    expect(row).toMatchObject({ suppressed: false, completed: 2, completionRate: 40 });
  });
  it('hides the totals breakdown when one hidden team could be derived by subtraction', () => {
    const rows = [
      team({ teamId: 'a', invited: 8 }),
      team({ teamId: 'b', invited: 3, completed: 1 }),
    ];
    const totals = engagementTotals(rows);
    expect(totals).toMatchObject({ invited: 11, completed: 0, lastActivityOn: null });
  });
  it('shows full totals when nothing is hidden', () => {
    const totals = engagementTotals([team({ teamId: 'a' }), team({ teamId: 'b' })]);
    expect(totals).toMatchObject({ invited: 20, completed: 6, completionRate: 30 });
  });
  it('shows nothing for an engagement under the minimum overall', () => {
    expect(engagementTotals([team({ invited: 3 })])).toBeNull();
  });
});

describe('reminder rule', () => {
  const base = {
    status: 'pending',
    createdOn: '2026-10-01',
    expiresAt: '2026-10-30T00:00:00Z',
    reminderCount: 0,
  };
  const day = (d: string) => new Date(`${d}T12:00:00Z`);
  it('is not due before day 3, due from day 3', () => {
    expect(isReminderDue(base, [3, 7], day('2026-10-03'))).toBe(false);
    expect(isReminderDue(base, [3, 7], day('2026-10-04'))).toBe(true);
  });
  it('consumes steps: the second step waits for day 7', () => {
    const once = { ...base, reminderCount: 1 };
    expect(isReminderDue(once, [3, 7], day('2026-10-06'))).toBe(false);
    expect(isReminderDue(once, [3, 7], day('2026-10-08'))).toBe(true);
    expect(isReminderDue({ ...base, reminderCount: 2 }, [3, 7], day('2026-10-20'))).toBe(false);
  });
  it('never reminds completed, revoked or expired invitations', () => {
    const late = day('2026-10-20');
    expect(isReminderDue({ ...base, status: 'submitted' }, [3], late)).toBe(false);
    expect(isReminderDue({ ...base, status: 'revoked' }, [3], late)).toBe(false);
    expect(isReminderDue({ ...base, expiresAt: '2026-10-10T00:00:00Z' }, [3], late)).toBe(false);
  });
  it('falls back to the default schedule for a bad setting', () => {
    expect(parseReminderDays([7, 3])).toEqual([3, 7]);
    expect(parseReminderDays([0])).toEqual([3, 7]);
    expect(parseReminderDays('x')).toEqual([3, 7]);
    expect(parseReminderDays([2, 5, 9])).toEqual([2, 5, 9]);
  });
});

describe('export helpers', () => {
  it('neutralises spreadsheet formulas and quotes separators', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(toCsv(['link', 'team'], [['https://x.invalid/s/t', 'Ops']])).toBe(
      'link,team\r\nhttps://x.invalid/s/t,Ops\r\n',
    );
  });
  it('builds links and resolves the base url safely', () => {
    expect(surveyLink('https://x.invalid/', 'a.b')).toBe('https://x.invalid/s/a.b');
    expect(resolveBaseUrl({ APP_BASE_URL: 'https://app.invalid/' }, 'evil.invalid', null)).toBe(
      'https://app.invalid',
    );
    expect(resolveBaseUrl({}, 'app.invalid', null)).toBe('https://app.invalid');
    expect(resolveBaseUrl({}, 'app.invalid', 'https')).toBe('https://app.invalid');
    // A local http copy, on a LAN address or a bare host name, gives http links.
    expect(resolveBaseUrl({}, '192.168.1.20:3000', 'http')).toBe('http://192.168.1.20:3000');
    expect(resolveBaseUrl({}, 'codebox:3000', null)).toBe('http://codebox:3000');
    expect(resolveBaseUrl({}, 'app.invalid', 'http')).toBe('http://app.invalid');
    expect(resolveBaseUrl({}, 'app.invalid', 'https, http')).toBe('https://app.invalid');
    expect(resolveBaseUrl({}, 'localhost:3101', 'http')).toBe('http://localhost:3101');
    expect(() => resolveBaseUrl({}, 'a b/<x>', null)).toThrow();
  });
});

describe('invitationNumbers', () => {
  const byStatus = { pending: 4, opened: 2, in_progress: 1, submitted: 3, expired: 1, revoked: 2 };

  it('counts invited without revoked links and opened as ever opened', () => {
    expect(invitationNumbers(byStatus)).toEqual({
      created: 13,
      revoked: 2,
      invited: 11,
      opened: 6,
      started: 4,
      completed: 3,
      waiting: 4,
      lapsed: 1,
    });
  });

  it('a single opened link is one opened, never two', () => {
    expect(invitationNumbers({ opened: 1 })).toMatchObject({ invited: 1, opened: 1, started: 0 });
  });

  it('agrees with the per-team totals of the Invitations page', () => {
    // The same 11 non-revoked links split in two teams of 5 and 6.
    const rows = [
      team({ teamId: 'a', invited: 5, opened: 3, started: 2, completed: 1 }),
      team({ teamId: 'b', invited: 6, opened: 3, started: 2, completed: 2 }),
    ];
    const totals = engagementTotals(rows);
    const n = invitationNumbers(byStatus);
    expect(totals).toMatchObject({
      invited: n.invited,
      opened: n.opened,
      started: n.started,
      completed: n.completed,
    });
  });
});
