import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { programs, cards } from '@/lib/db/schema';
import type { CardWithProgram } from '@/types/db';

interface RouteParams {
  params: Promise<{ wallet: string }>;
}

/** GET /api/customer/[wallet]/cards — returns all stamp cards for a customer wallet, joined with program metadata. */
export async function GET(_req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { wallet } = await params;

  if (!wallet || !wallet.startsWith('0x')) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  const rows = await db
    .select({
      cardId: cards.cardId,
      programId: cards.programId,
      customerAddress: cards.customerAddress,
      currentStamps: cards.currentStamps,
      totalEarned: cards.totalEarned,
      lastStampedAt: cards.lastStampedAt,
      stampsRequired: programs.stampsRequired,
      merchantName: programs.name,
      logoUrl: programs.logoUrl,
      rewardDescription: programs.rewardDescription,
      isActive: programs.isActive,
      themeId: programs.themeId,
    })
    .from(cards)
    .innerJoin(programs, eq(cards.programId, programs.programId))
    .where(eq(cards.customerAddress, wallet));

  const result: CardWithProgram[] = rows.map((row) => ({
    ...row,
    lastStampedAt: row.lastStampedAt?.toISOString() ?? null,
  }));

  return NextResponse.json(result);
}
