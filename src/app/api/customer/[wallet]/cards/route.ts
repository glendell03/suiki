import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stampCards, stampPrograms, merchantProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { CardWithProgram } from '@/types/db';

interface RouteParams {
  params: Promise<{ wallet: string }>;
}

/** GET /api/customer/[wallet]/cards — returns all stamp cards for a customer wallet. */
export async function GET(_req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { wallet } = await params;

  if (!wallet || !wallet.startsWith('0x')) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  const rows = await db
    .select({
      suiObjectId: stampCards.suiObjectId,
      currentStamps: stampCards.currentStamps,
      totalEarned: stampCards.totalEarned,
      lastStamped: stampCards.lastStamped,
      programSuiObjectId: stampPrograms.suiObjectId,
      programName: stampPrograms.name,
      stampsRequired: stampPrograms.stampsRequired,
      isActive: stampPrograms.isActive,
      themeId: stampPrograms.themeId,
      logoUrl: merchantProfiles.logoUrl,
      rewardDescription: stampPrograms.rewardDescription,
      businessName: merchantProfiles.businessName,
      merchantWallet: merchantProfiles.walletAddress,
    })
    .from(stampCards)
    .innerJoin(stampPrograms, eq(stampCards.programId, stampPrograms.id))
    .innerJoin(merchantProfiles, eq(stampPrograms.merchantProfileId, merchantProfiles.id))
    .where(eq(stampCards.customerWallet, wallet));

  const cards: CardWithProgram[] = rows.map((row) => ({
    ...row,
    lastStamped: row.lastStamped?.toISOString() ?? null,
  }));

  return NextResponse.json({ data: cards });
}
