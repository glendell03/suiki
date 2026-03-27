import { NextResponse } from 'next/server';
import { env } from '@/env';
import { processTick } from '@/lib/indexer/indexer';

/**
 * POST /api/indexer/tick
 *
 * Called by Vercel Cron every minute (see vercel.json).
 * Processes one page of Sui events and syncs them to Postgres.
 * Secured by x-cron-secret header to prevent public invocation.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const secret = request.headers.get('x-cron-secret');
  if (secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[indexer/tick]', err);
    return NextResponse.json({ error: 'Indexer tick failed' }, { status: 500 });
  }
}
