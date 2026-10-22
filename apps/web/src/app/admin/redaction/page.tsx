import { redirectLegacy } from '@/lib/legacyRoute';

/** Removed from the UI by TASK-AD2 (ADR 0049); the data stays. */
export default function OldPage({ searchParams }: { searchParams: { tenant?: string } }) {
  redirectLegacy('/admin/engagements', searchParams.tenant);
}
