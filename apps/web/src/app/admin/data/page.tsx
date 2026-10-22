import { redirectLegacy } from '@/lib/legacyRoute';

/** Moved to workspace Settings by TASK-AD2 (ADR 0049). */
export default function OldPage({ searchParams }: { searchParams: { tenant?: string } }) {
  redirectLegacy('/admin/settings/data', searchParams.tenant);
}
