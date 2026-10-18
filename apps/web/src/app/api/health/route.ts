import { NextResponse } from 'next/server';
import { pingDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'fra1';

/**
 * Uptime probe (TASK-K). Runs `SELECT 1` through the app role: no data is read and nothing is
 * returned beyond two booleans. 200 when the database answers, 503 otherwise.
 */
export async function GET() {
  let db = false;
  try {
    db = await pingDatabase();
  } catch {
    db = false;
  }
  return NextResponse.json({ ok: db, db }, { status: db ? 200 : 503 });
}
