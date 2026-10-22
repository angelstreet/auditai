import { redirect } from 'next/navigation';
import { ORG_UUID } from './orgShared';

/**
 * Old admin screens removed by TASK-AD2 (ADR 0049) answer with a redirect to where the same thing
 * lives now, keeping the organisation. Bookmarks and links in old messages keep working.
 */
export const legacyTarget = (path: string, tenant?: string): string =>
  tenant && ORG_UUID.test(tenant) ? `${path}?tenant=${encodeURIComponent(tenant)}` : path;

export const redirectLegacy = (path: string, tenant?: string): never =>
  redirect(legacyTarget(path, tenant));
