import { redirectLegacy } from '@/lib/legacyRoute';

/** The portfolio board is gone (TASK-AD2, ADR 0049): Missions is the home. */
export default function OldBoardPage({ searchParams }: { searchParams: { tenant?: string } }) {
  redirectLegacy('/admin/engagements', searchParams.tenant);
}
