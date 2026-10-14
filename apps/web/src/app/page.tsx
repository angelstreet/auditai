import { redirect } from 'next/navigation';

/**
 * Landing redirect \u2014 the app is not browseable; it is reached by a secure invitation link
 * (PRD \u00a75, \u00a716). The root page simply explains that and points at the docs.
 */
export default function HomePage(): never {
  redirect('/about');
}
