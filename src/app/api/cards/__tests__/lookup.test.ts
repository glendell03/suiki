import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before importing the module under test
// ---------------------------------------------------------------------------

// Only mockLimit is a vi.fn() — vi.clearAllMocks() resets it between tests
// without breaking the chain. The rest are plain arrow functions so the
// chain always resolves correctly after each clearAllMocks() call.
const mockLimit = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: (...args: unknown[]) => mockLimit(...args),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  cards: Symbol('cards'),
  programs: Symbol('programs'),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ _eq: val })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
}));

// Import after mocks
import { GET } from '../lookup/route';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/cards/lookup');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

const VALID_CUSTOMER = '0x' + 'a'.repeat(64);
const VALID_PROGRAM  = '0x' + 'b'.repeat(64);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cards/lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when customer param is missing', async () => {
    const res = await GET(makeRequest({ program: VALID_PROGRAM }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/missing/i);
  });

  it('returns 400 when program param is missing', async () => {
    const res = await GET(makeRequest({ customer: VALID_CUSTOMER }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/missing/i);
  });

  it('returns 400 for an invalid customer address format', async () => {
    const res = await GET(makeRequest({ customer: 'not-an-address', program: VALID_PROGRAM }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid/i);
  });

  it('returns 400 for an invalid program address format', async () => {
    const res = await GET(makeRequest({ customer: VALID_CUSTOMER, program: 'bad' }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid/i);
  });

  it('returns { card: null } when no card is found', async () => {
    mockLimit.mockResolvedValueOnce([]);
    const res = await GET(makeRequest({ customer: VALID_CUSTOMER, program: VALID_PROGRAM }));
    expect(res.status).toBe(200);
    const body = await res.json() as { card: null };
    expect(body.card).toBeNull();
  });

  it('returns a StampCard-shaped object when a card is found', async () => {
    const dbRow = {
      objectId: '0x' + 'c'.repeat(64),
      programId: VALID_PROGRAM,
      customer: VALID_CUSTOMER,
      currentStamps: 3,
      stampsRequired: 10,
      totalEarned: 0,
      lastStampedAt: new Date('2026-01-01T00:00:00Z'),
    };
    mockLimit.mockResolvedValueOnce([dbRow]);

    const res = await GET(makeRequest({ customer: VALID_CUSTOMER, program: VALID_PROGRAM }));
    expect(res.status).toBe(200);
    const body = await res.json() as { card: Record<string, unknown> };
    expect(body.card).toMatchObject({
      objectId: dbRow.objectId,
      programId: dbRow.programId,
      customer: dbRow.customer,
      currentStamps: 3,
      stampsRequired: 10,
      totalEarned: 0,
      version: 0,
    });
    expect(typeof body.card['lastStamped']).toBe('number');
  });

  it('maps null lastStampedAt to lastStamped: 0', async () => {
    mockLimit.mockResolvedValueOnce([{
      objectId: '0x' + 'c'.repeat(64),
      programId: VALID_PROGRAM,
      customer: VALID_CUSTOMER,
      currentStamps: 0,
      stampsRequired: 5,
      totalEarned: 0,
      lastStampedAt: null,
    }]);

    const res = await GET(makeRequest({ customer: VALID_CUSTOMER, program: VALID_PROGRAM }));
    const body = await res.json() as { card: Record<string, unknown> };
    expect(body.card['lastStamped']).toBe(0);
  });
});
