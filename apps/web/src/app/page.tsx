import { redirect } from 'next/navigation';

/**
 * Landing redirect.
 *
 * The app is reached by a secure invitation link (PRD \u00a75, \u00a716), but
 * the public hero (M12 sponsor onboarding) is a richer entry point than
 * the static `/about` page. Visitors land on `/welcome` so the brand
 * story + the survey entry points are visible immediately.
 */
export default function HomePage(): never {
  redirect('/welcome');
}
