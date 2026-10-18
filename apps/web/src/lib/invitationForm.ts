import { isPlausibleEmail } from './invitationCrypto';
import { MAX_ADDRESSES_PER_BATCH, MAX_BATCH } from './invitationData';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string): boolean => UUID.test(v);

export type CreateFormError = 'bad_count' | 'bad_expiry' | 'bad_address' | 'bad_team';

export type ParsedCreateForm =
  | {
      ok: true;
      groups: { teamId: string; count: number }[];
      addresses: { teamId: string; address: string }[];
      expiresInDays: number;
    }
  | { ok: false; error: CreateFormError };

/**
 * Parse the "create invitations" form. Counts are `count:<teamId>` fields; addresses (email mode
 * only) are one per line in `addresses`, all for the team in `addressTeam`. Pure, so the rules are
 * unit-tested without a browser.
 */
export const parseCreateForm = (fd: {
  get(name: string): unknown;
  keys(): Iterable<string>;
}): ParsedCreateForm => {
  const groups: { teamId: string; count: number }[] = [];
  for (const key of fd.keys()) {
    if (!key.startsWith('count:')) continue;
    const teamId = key.slice(6);
    const raw = String(fd.get(key) ?? '').trim();
    if (raw === '') continue;
    const count = Number(raw);
    if (!isUuid(teamId)) return { ok: false, error: 'bad_team' };
    if (!Number.isInteger(count) || count < 0 || count > MAX_BATCH) {
      return { ok: false, error: 'bad_count' };
    }
    if (count > 0) groups.push({ teamId, count });
  }
  const addresses: { teamId: string; address: string }[] = [];
  const rawAddresses = String(fd.get('addresses') ?? '').trim();
  if (rawAddresses !== '') {
    const teamId = String(fd.get('addressTeam') ?? '');
    if (!isUuid(teamId)) return { ok: false, error: 'bad_team' };
    const lines = rawAddresses
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > MAX_ADDRESSES_PER_BATCH) return { ok: false, error: 'bad_count' };
    for (const line of lines) {
      if (!isPlausibleEmail(line)) return { ok: false, error: 'bad_address' };
      addresses.push({ teamId, address: line });
    }
  }
  const expiresInDays = Number(String(fd.get('expiresInDays') ?? '14'));
  if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 90) {
    return { ok: false, error: 'bad_expiry' };
  }
  const total = groups.reduce((s, g) => s + g.count, 0) + addresses.length;
  if (total < 1 || total > MAX_BATCH) return { ok: false, error: 'bad_count' };
  return { ok: true, groups, addresses, expiresInDays };
};
