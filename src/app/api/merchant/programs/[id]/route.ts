/**
 * PUT /api/merchant/programs/[id]
 *
 * Updates off-chain metadata for an existing program.
 * Requires merchantAddress in the body to verify ownership — only the
 * original merchant can modify their own program's metadata.
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';

import { db } from '@/lib/db';
import { programs } from '@/lib/db/schema';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const body = await req.json();
  const { merchantAddress, name, logoUrl, rewardDescription } = body;

  if (!merchantAddress) {
    return NextResponse.json(
      { error: 'merchantAddress required' },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(programs)
    .set({ name, logoUrl, rewardDescription, updatedAt: new Date() })
    .where(
      and(
        eq(programs.programId, id),
        eq(programs.merchantAddress, merchantAddress),
      ),
    )
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: 'Program not found or not authorized' },
      { status: 404 },
    );
  }

  return NextResponse.json(updated);
}
