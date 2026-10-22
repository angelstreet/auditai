import { redirectLegacy } from '@/lib/legacyRoute';

/** Reports are a tab of each mission now (TASK-AD2). */
export default function OldReportsPage({ searchParams }: { searchParams: { tenant?: string } }) {
  redirectLegacy('/admin/engagements', searchParams.tenant);
}
