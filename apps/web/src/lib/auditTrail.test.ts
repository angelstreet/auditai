import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { messages } from '@evolai/i18n';
import { AUDIT_GROUPS, actionKey, parseDay, parseGroup } from './auditTrail';

/** The last migration that sets audit_log_action_check is the list the screen has to speak. */
const migrationActions = (): string[] => {
  const dir = join(__dirname, '..', '..', '..', '..', 'infra', 'db', 'migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8');
    const m = sql.match(/audit_log_action_check CHECK \(action IN \(([\s\S]*?)\)\);/);
    if (m) return [...(m[1] as string).matchAll(/'([a-z_.]+)'/g)].map((x) => x[1] as string);
  }
  return [];
};

describe('audit trail screen', () => {
  const actions = migrationActions();
  it('has a plain-words label in both languages for every action the trail can hold', () => {
    expect(actions.length).toBeGreaterThan(40);
    for (const a of actions) {
      for (const l of ['en', 'fr'] as const) {
        const label = (messages[l].trust.audit.action as Record<string, string>)[actionKey(a)];
        expect(label, `${l}: ${a}`).toBeTruthy();
      }
    }
  });
  it('only groups actions the trail really has, each once', () => {
    const grouped = Object.values(AUDIT_GROUPS).flat();
    for (const a of grouped) expect(actions, a).toContain(a);
    expect(new Set(grouped).size).toBe(grouped.length);
  });
  it('covers exports, erasures, view-as, invitations and settings', () => {
    expect(AUDIT_GROUPS.export).toContain('export.complete');
    expect(AUDIT_GROUPS.erase).toContain('pseudonym.erase');
    expect(AUDIT_GROUPS.viewAs).toContain('view_as.start');
    expect(AUDIT_GROUPS.invitations).toContain('invitation.create_batch');
    expect(AUDIT_GROUPS.invitations).toContain('referent.invite');
    expect(AUDIT_GROUPS.settings).toContain('engagement.update');
  });
  it('parses filters strictly', () => {
    expect(parseGroup('erase')).toBe('erase');
    expect(parseGroup('x; drop')).toBe('all');
    expect(parseDay('2026-10-19')).toBe('2026-10-19');
    expect(parseDay('2026-02-31')).toBeUndefined();
    expect(parseDay("2026-10-19'; --")).toBeUndefined();
  });
});
