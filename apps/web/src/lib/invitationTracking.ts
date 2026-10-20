/**
 * Pure rules for invitation tracking and reminders (FR-03, ADR 0033, PRD §15, §25.1).
 * No database and no I/O here, so the privacy rules are unit-testable.
 */

/** A team with fewer invitations than this shows no numbers, only "fewer than 5". */
export const MIN_GROUP_SIZE = 5;

/** Default reminder schedule: days after creation. Stored per engagement in privacy_json. */
export const DEFAULT_REMINDER_DAYS: readonly number[] = [3, 7];

/** Hard cap on emails one reminder run may send per engagement (rate limit). */
export const MAX_REMINDERS_PER_RUN = 200;

/**
 * The one definition of the invitation numbers, used by the Engagements list and the Invitations
 * page alike (TASK-Z1). From the number of invitations per status:
 *  - created   every link made, revoked ones included;
 *  - invited   links still valid or used: created minus revoked;
 *  - opened    opened at least once: opened, in progress or answered (so opened >= started >= done);
 *  - started   in progress or answered;
 *  - completed answered;
 *  - waiting   not opened yet;
 *  - lapsed    expired or declined, still counted as invited.
 */
export interface InvitationNumbers {
  readonly created: number;
  readonly revoked: number;
  readonly invited: number;
  readonly opened: number;
  readonly started: number;
  readonly completed: number;
  readonly waiting: number;
  readonly lapsed: number;
}

export const invitationNumbers = (
  byStatus: Readonly<Record<string, number>>,
): InvitationNumbers => {
  const n = (k: string): number => byStatus[k] ?? 0;
  const created = Object.values(byStatus).reduce((s, v) => s + v, 0);
  return {
    created,
    revoked: n('revoked'),
    invited: created - n('revoked'),
    opened: n('opened') + n('in_progress') + n('submitted'),
    started: n('in_progress') + n('submitted'),
    completed: n('submitted'),
    waiting: n('pending'),
    lapsed: n('expired') + n('declined'),
  };
};

export interface TeamCounts {
  readonly teamId: string;
  readonly teamName: string;
  readonly invited: number;
  readonly opened: number;
  readonly started: number;
  readonly completed: number;
  /** ISO day (YYYY-MM-DD) of the latest activity, or null. */
  readonly lastActivityOn: string | null;
}

export type TeamProgressRow =
  | {
      readonly suppressed: true;
      readonly teamId: string;
      readonly teamName: string;
      readonly invited: number;
    }
  | {
      readonly suppressed: false;
      readonly teamId: string;
      readonly teamName: string;
      readonly invited: number;
      readonly opened: number;
      readonly started: number;
      readonly completed: number;
      /** 0..100, whole percent of invited. */
      readonly completionRate: number;
      readonly lastActivityOn: string | null;
    };

const pct = (part: number, whole: number): number =>
  whole <= 0 ? 0 : Math.round((part / whole) * 100);

/**
 * Apply the minimum group size. A suppressed row carries no counts apart from the invitation
 * total, which the admin chose when creating the batch; the activity day is dropped too, because
 * with a handful of people even a date can point at someone.
 */
export const applyMinGroup = (rows: readonly TeamCounts[]): TeamProgressRow[] =>
  rows.map((r) =>
    r.invited < MIN_GROUP_SIZE
      ? { suppressed: true, teamId: r.teamId, teamName: r.teamName, invited: r.invited }
      : {
          suppressed: false,
          teamId: r.teamId,
          teamName: r.teamName,
          invited: r.invited,
          opened: r.opened,
          started: r.started,
          completed: r.completed,
          completionRate: pct(r.completed, r.invited),
          lastActivityOn: r.lastActivityOn,
        },
  );

export interface EngagementTotals {
  readonly invited: number;
  readonly opened: number;
  readonly started: number;
  readonly completed: number;
  readonly completionRate: number;
  readonly lastActivityOn: string | null;
}

/**
 * Engagement-level totals. Computed from the raw counts, but a small team still must not leak
 * through subtraction: when exactly one team is suppressed the total minus the visible teams would
 * reveal its numbers, so in that case the suppressed team's counts are folded away by also hiding
 * the totals' breakdown. Rule: if any team is suppressed and the engagement has fewer than
 * 2 * MIN_GROUP_SIZE invitations in total, totals are shown as invited only.
 */
export const engagementTotals = (rows: readonly TeamCounts[]): EngagementTotals | null => {
  const invited = rows.reduce((s, r) => s + r.invited, 0);
  if (invited < MIN_GROUP_SIZE) return null;
  const anySuppressed = rows.some((r) => r.invited < MIN_GROUP_SIZE);
  const sum = (k: 'opened' | 'started' | 'completed') => rows.reduce((s, r) => s + r[k], 0);
  const last = rows.map((r) => r.lastActivityOn).filter((d): d is string => d !== null);
  if (anySuppressed && rows.filter((r) => r.invited >= MIN_GROUP_SIZE).length === rows.length - 1) {
    // Exactly one hidden team: totals minus visible teams would reveal it.
    return {
      invited,
      opened: 0,
      started: 0,
      completed: 0,
      completionRate: 0,
      lastActivityOn: null,
    };
  }
  return {
    invited,
    opened: sum('opened'),
    started: sum('started'),
    completed: sum('completed'),
    completionRate: pct(sum('completed'), invited),
    lastActivityOn: last.length ? last.sort().at(-1)! : null,
  };
};

export interface ReminderCandidate {
  readonly status: string;
  readonly createdOn: string;
  readonly expiresAt: string;
  readonly reminderCount: number;
}

const DAY_MS = 86_400_000;

/**
 * Is this invitation due a reminder at `now`? Only not-completed, not-revoked invitations, only
 * before expiry, and only for the next unsent step of the schedule (so a run is idempotent: the
 * step is consumed when it is recorded).
 */
export const isReminderDue = (
  c: ReminderCandidate,
  schedule: readonly number[],
  now: Date,
): boolean => {
  if (!['pending', 'opened', 'in_progress'].includes(c.status)) return false;
  if (new Date(c.expiresAt).getTime() <= now.getTime()) return false;
  const stepDays = schedule[c.reminderCount];
  if (stepDays === undefined) return false;
  const dueAt = new Date(`${c.createdOn}T00:00:00Z`).getTime() + stepDays * DAY_MS;
  return dueAt <= now.getTime();
};

/** Validate a schedule from settings: 1..5 strictly increasing whole days between 1 and 60. */
export const parseReminderDays = (raw: unknown): readonly number[] => {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 5) return DEFAULT_REMINDER_DAYS;
  const days = raw.map((d) => Number(d));
  const ok = days.every(
    (d, i) => Number.isInteger(d) && d >= 1 && d <= 60 && (i === 0 || d > days[i - 1]!),
  );
  return ok ? days : DEFAULT_REMINDER_DAYS;
};

/** Guard against spreadsheet formula injection and stray separators in exported cells. */
export const csvCell = (value: string): string => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const toCsv = (header: readonly string[], rows: readonly (readonly string[])[]): string =>
  [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

/** Absolute survey link for a signed token. */
export const surveyLink = (baseUrl: string, token: string): string =>
  `${baseUrl.replace(/\/+$/, '')}/s/${token}`;

/**
 * Admin-only base URL: APP_BASE_URL, else the site URL setting (NEXT_PUBLIC_SITE_URL), else the
 * request host (https, except http for a local or private-network host).
 * Never a path or query.
 */
export const resolveBaseUrl = (
  env: Record<string, string | undefined>,
  host: string | null,
  proto: string | null,
): string => {
  for (const key of ['APP_BASE_URL', 'NEXT_PUBLIC_SITE_URL']) {
    const configured = env[key]?.replace(/\/+$/, '');
    if (configured && /^https?:\/\/[^\s/]+$/.test(configured)) return configured;
  }
  if (host && /^[A-Za-z0-9.-]+(:\d+)?$/.test(host)) {
    // Production is https: a public host always gets https, whatever a header says. A local or
    // private-network host (a plain local copy) gets http unless the proxy says it is https.
    const said = proto?.split(',')[0]?.trim().toLowerCase();
    const hostname = host.replace(/:\d+$/, '');
    const local =
      /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|[^.]+)$/.test(
        hostname,
      ) || hostname.endsWith('.local');
    const p = local && said !== 'https' ? 'http' : 'https';
    return `${p}://${host}`;
  }
  throw new Error('APP_BASE_URL is not set and the request has no usable host.');
};
