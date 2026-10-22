import { redirectLegacy } from '@/lib/legacyRoute';

/** Set-up is a mission now (TASK-AD2, ADR 0049): the intake page sends staff to Missions. */
export default function OldIntakePage() {
  redirectLegacy('/admin/engagements');
}
