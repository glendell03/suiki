/**
 * GET /api/programs/[programId]
 *
 * Returns a single program's off-chain metadata by its SUI object ID.
 * Used by customer views to display stamp card details (name, logo, reward).
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { programs } from '@/lib/db/schema';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ programId: string }> },
): Promise<NextResponse> {
  const { programId } = await params;

  const [row] = await db
    .select()
    .from(programs)
    .where(eq(programs.programId, programId));

  if (!row) {
    return NextResponse.json({ error: 'Program not found' }, { status: 404 });
  }

  return NextResponse.json(row);
}
