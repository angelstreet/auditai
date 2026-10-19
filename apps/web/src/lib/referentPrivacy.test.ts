import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * TASK-S, ADR 0038: a team referent knows which link went to which colleague, so no page, route or
 * export they can reach may depend on a per-link status. This guard reads the source of every file
 * behind the team space and fails if one imports a per-link status listing or selects a status
 * column for a link. The Playwright spec `referent-share.spec.ts` checks the same rule end to end.
 */

const SRC = join(__dirname, '..');
const REFERENT_ROOTS = ['app/client', 'components/client'];

/** Auditor-only functions: per-link status lists, raw counts, the auditor's export. */
const FORBIDDEN_IMPORTS = [
  'listOpen',
  'reminderList',
  'markReminded',
  'withAudit',
  'progress',
  'teamCounts',
  'applyMinGroup',
  'engagementTotals',
];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

const files = REFERENT_ROOTS.flatMap((root) => walk(join(SRC, root)));

const importedNames = (source: string): string[] =>
  [...source.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)].flatMap(
    (m) =>
      /invitationData|invitationTracking/.test(m[2] ?? '')
        ? (m[1] ?? '')
            .split(',')
            .map((s) =>
              s
                .trim()
                .split(/\s+as\s+/)[0]!
                .replace(/^type\s+/, ''),
            )
            .filter(Boolean)
        : [],
  );

const sliceOf = (source: string, name: string): string => {
  const start = source.indexOf(`export const ${name} = `);
  expect(start, `${name} exists`).toBeGreaterThanOrEqual(0);
  const next = source.indexOf('\nexport ', start + 1);
  return source.slice(start, next === -1 ? undefined : next);
};

describe('team space never sees a per-link status', () => {
  it('covers the referent files', () => {
    const rel = files.map((f) => relative(SRC, f));
    expect(rel).toContain('app/client/page.tsx');
    expect(rel).toContain('app/client/invitations/page.tsx');
    expect(rel).toContain('app/client/invitations/export/route.ts');
    expect(rel).toContain('app/client/invitations/sheet/page.tsx');
  });

  for (const file of files) {
    it(`${relative(SRC, file)} imports no auditor-only listing`, () => {
      const names = importedNames(readFileSync(file, 'utf8'));
      expect(names.filter((n) => FORBIDDEN_IMPORTS.includes(n))).toEqual([]);
    });
  }

  it('the referent export ignores ?kind= and has no reminders variant', () => {
    const route = readFileSync(join(SRC, 'app/client/invitations/export/route.ts'), 'utf8');
    expect(route).not.toMatch(/searchParams/);
    expect(route).not.toMatch(/reminder/i);
  });

  it('the referent link query selects no status, expiry or reminder column, and does not filter on them', () => {
    const data = readFileSync(join(SRC, 'lib/invitationData.ts'), 'utf8');
    const fn = sliceOf(data, 'listTeamLinks');
    const select = fn.slice(fn.indexOf('SELECT'), fn.indexOf('FROM'));
    expect(select).not.toMatch(/status|expires|reminder|last_activity|opened|submitted/);
    // The only status condition allowed is "not revoked" (a revoked link no longer works).
    const statusConds = [...fn.matchAll(/i\.status\s*([^\n]*)/g)].map((m) => m[1]?.trim());
    expect(statusConds).toEqual(["<> 'revoked'"]);
    expect(fn).not.toMatch(/submissions|answers|respondents/);
  });

  it('clientData uses raw counts only through referentParticipation', () => {
    const data = readFileSync(join(SRC, 'lib/clientData.ts'), 'utf8');
    const fn = sliceOf(data, 'referentProgress');
    expect(fn).toMatch(/teamCounts\(/);
    expect(fn).toMatch(/referentParticipation\(/);
    expect(data.match(/teamCounts\(/g)).toHaveLength(1);
  });
});
