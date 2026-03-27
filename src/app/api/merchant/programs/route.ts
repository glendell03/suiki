/**
 * Merchant programs API — GET + POST /api/merchant/programs
 *
 * GET  ?merchant=0x...  — list all programs owned by a merchant wallet.
 * POST { programId, merchantAddress, name, logoUrl, rewardDescription, stampsRequired }
 *      — create or upsert off-chain program metadata after the on-chain
 *        create_program transaction succeeds.
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { programs } from '@/lib/db/schema';

/** GET /api/merchant/programs?merchant=0x... */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const merchantAddress = req.nextUrl.searchParams.get('merchant');

  if (!merchantAddress) {
    return NextResponse.json(
      { error: 'merchant param required' },
      { status: 400 },
    );
  }

  const rows = await db
    .select()
    .from(programs)
    .where(eq(programs.merchantAddress, merchantAddress));

  return NextResponse.json(rows);
}

/** POST /api/merchant/programs */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const {
    programId,
    merchantAddress,
    name,
    logoUrl,
    rewardDescription,
    stampsRequired,
  } = body;

  if (
    !programId ||
    !merchantAddress ||
    !name ||
    !logoUrl ||
    !rewardDescription ||
    !stampsRequired
  ) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(programs)
    .values({
      programId,
      merchantAddress,
      name,
      logoUrl,
      rewardDescription,
      stampsRequired: Number(stampsRequired),
    })
    .onConflictDoUpdate({
      target: programs.programId,
      set: {
        name,
        logoUrl,
        rewardDescription,
        stampsRequired: Number(stampsRequired),
      },
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
