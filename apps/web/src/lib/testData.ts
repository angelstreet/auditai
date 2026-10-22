import { cookies } from 'next/headers';
import { withServiceAccount } from './db';

/**
 * Test organisations (TASK-AD2, ADR 0049). The synthetic seed creates organisations whose slug starts
 * with `synthetic-`; they stay in the database but are not listed next to real clients unless an
 * owner turns on "Show test data". When a person has only test organisations (a local run, the
 * end-to-end tests) they are shown, so a screen never goes empty because of this filter.
 */
export const SHOW_TEST_COOKIE = 'evolai_show_test';

export const isTestSlug = (slug: string): boolean => /^synthetic-/.test(slug);

/** Ids to list: test ones are dropped unless `show` is on or nothing would be left. */
export const listableIds = <T extends string>(
  ids: readonly T[],
  testIds: ReadonlySet<string>,
  show: boolean,
): T[] => {
  if (show) return [...ids];
  const real = ids.filter((id) => !testIds.has(id));
  return real.length > 0 ? real : [...ids];
};

/** Same ids with the test ones moved last, so the default organisation is a real one. */
export const realFirst = <T extends string>(
  ids: readonly T[],
  testIds: ReadonlySet<string>,
): T[] => [...ids.filter((id) => !testIds.has(id)), ...ids.filter((id) => testIds.has(id))];

// Organisations are created rarely: one lookup a minute is plenty.
let memo: { at: number; ids: ReadonlySet<string> } | null = null;
const TTL_MS = 60_000;

/** Ids of the test organisations (an empty set when the lookup fails: nothing is hidden). */
export const testTenantIds = async (): Promise<ReadonlySet<string>> => {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.ids;
  const ids = await withServiceAccount(async (client) => {
    const { rows } = await client.query<{ id: string; slug: string }>(
      'SELECT id, slug FROM tenants',
    );
    return new Set(rows.filter((r) => isTestSlug(r.slug)).map((r) => r.id));
  }).catch(() => null);
  if (!ids) return new Set();
  memo = { at: Date.now(), ids };
  return ids;
};

export const showTestData = (): boolean => cookies().get(SHOW_TEST_COOKIE)?.value === '1';
