import { NextResponse } from 'next/server';
import { processTick } from '@/lib/indexer/indexer';

/**
 * POST /api/indexer/sync
 *
 * Client-triggered indexer run. Called by the frontend when it detects a
 * StampIssued event so the DB updates immediately rather than waiting for
 * the Vercel Cron tick (up to 1 minute).
 *
 * Safe to call without auth: processTick() is idempotent (cursor-based) and
 * only reads from Sui / writes to our own Postgres. Worst case is a redundant
 * DB write if called when already up-to-date.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const result = await processTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[indexer/sync]', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
