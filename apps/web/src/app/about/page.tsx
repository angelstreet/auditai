import { redirect } from 'next/navigation';

/** The front page is the About: old links and bookmarks land there. */
export const dynamic = 'force-dynamic';

export default function AboutPage(): never {
  redirect('/');
}
