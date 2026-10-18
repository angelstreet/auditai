import { NextResponse } from 'next/server';
import { LEGACY_SESSION_COOKIE, SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = new NextResponse(null, { status: 303, headers: { location: '/login' } });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  res.cookies.set(LEGACY_SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
