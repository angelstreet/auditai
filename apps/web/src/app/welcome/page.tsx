import { redirect } from 'next/navigation';

/** The front page moved to `/`; keep old links working. */
export const dynamic = 'force-dynamic';

export default function WelcomePage(): never {
  redirect('/');
}
