import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cards, programs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { StampCard, SuiObjectId, SuiAddress } from '@/types/sui';

const SUI_ADDRESS_RE = /^0x[0-9a-fA-F]{64}$/;

/**
 * GET /api/cards/lookup?customer=<address>&program=<address>
 *
 * Returns the customer's StampCard for a given program from the Postgres index.
 * Single indexed JOIN — replaces the two-RPC-call blockchain lookup in the scan
 * hot path. Sub-millisecond at any reasonable table size.
 *
 * Response shapes:
 *   200 { card: StampCard } — card found
 *   200 { card: null }      — no card yet (new customer)
 *   400 { error: string }   — missing or malformed params
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const customer = searchParams.get('customer');
  const program  = searchParams.get('program');

  if (!customer || !program) {
    return NextResponse.json(
      { error: 'Missing customer or program query param' },
      { status: 400 },
    );
  }

  if (!SUI_ADDRESS_RE.test(customer) || !SUI_ADDRESS_RE.test(program)) {
    return NextResponse.json(
      { error: 'Invalid address format — expected 0x followed by 64 hex chars' },
      { status: 400 },
    );
  }

  let rows: Array<{
    objectId: string;
    programId: string;
    customer: string;
    currentStamps: number;
    stampsRequired: number;
    totalEarned: number;
    lastStampedAt: Date | null;
  }>;

  try {
    rows = await db
      .select({
        objectId:       cards.cardId,
        programId:      cards.programId,
        customer:       cards.customerAddress,
        currentStamps:  cards.currentStamps,
        stampsRequired: programs.stampsRequired,
        totalEarned:    cards.totalEarned,
        lastStampedAt:  cards.lastStampedAt,
      })
      .from(cards)
      .innerJoin(programs, eq(cards.programId, programs.programId))
      .where(
        and(
          eq(cards.customerAddress, customer),
          eq(cards.programId, program),
        ),
      )
      .limit(1);
  } catch {
    return NextResponse.json({ error: 'Card lookup failed' }, { status: 500 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ card: null });
  }

  const [r] = rows;
  const card: StampCard = {
    objectId:      r.objectId as SuiObjectId,
    programId:     r.programId as SuiObjectId,
    customer:      r.customer as SuiAddress,
    currentStamps: r.currentStamps,
    stampsRequired: r.stampsRequired,
    totalEarned:   r.totalEarned,
    lastStamped:   r.lastStampedAt ? r.lastStampedAt.getTime() : 0,
    version:       0,
  };

  return NextResponse.json({ card });
}
