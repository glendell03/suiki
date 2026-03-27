import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for the indexer core (processTick).
 *
 * All external dependencies (db, SUI RPC, handlers) are mocked so tests
 * run without network or database access.
 */

// ---------------------------------------------------------------------------
// Mocks — set up before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ _eq: val })),
}));

const mockFindFirst = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      indexerCursor: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...vArgs: unknown[]) => {
          mockValues(...vArgs);
          return {
            onConflictDoUpdate: (...cArgs: unknown[]) =>
              mockOnConflictDoUpdate(...cArgs),
          };
        },
      };
    },
  },
}));

vi.mock('@/lib/db/schema', () => ({
  indexerCursor: Symbol('indexerCursor'),
}));

const mockQueryEvents = vi.fn();

vi.mock('@mysten/sui/jsonRpc', () => ({
  SuiJsonRpcClient: function SuiJsonRpcClient() {
    return { queryEvents: mockQueryEvents };
  },
  getJsonRpcFullnodeUrl: () => 'https://rpc.test',
}));

vi.mock('@/lib/constants', () => ({
  PACKAGE_ID: '0xTEST_PKG',
  MODULE_NAME: 'suiki',
  SUI_NETWORK: 'testnet',
  EVENT_TYPES: {
    programCreated: '0xTEST_PKG::suiki::ProgramCreated',
    cardCreated: '0xTEST_PKG::suiki::CardCreated',
    stampIssued: '0xTEST_PKG::suiki::StampIssued',
    stampRedeemed: '0xTEST_PKG::suiki::StampRedeemed',
    programUpdated: '0xTEST_PKG::suiki::ProgramUpdated',
    programDeactivated: '0xTEST_PKG::suiki::ProgramDeactivated',
    programReactivated: '0xTEST_PKG::suiki::ProgramReactivated',
    stafferCapCreated: '0xTEST_PKG::suiki::StafferCapCreated',
  },
}));

/** Stub handlers — individual handlers and the dispatcher. */
vi.mock('../handlers', () => ({
  handleProgramCreated: vi.fn(),
  handleProgramUpdated: vi.fn(),
  handleProgramDeactivated: vi.fn(),
  handleProgramReactivated: vi.fn(),
  handleCardCreated: vi.fn(),
  handleStampIssued: vi.fn(),
  handleStampRedeemed: vi.fn(),
  dispatchEvent: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks are in place
import { processTick } from '../indexer';

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('processTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero processed when there are no events', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    mockQueryEvents.mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
    });

    const result = await processTick();

    expect(result).toEqual({ processed: 0, hasMore: false });
    expect(mockQueryEvents).toHaveBeenCalledOnce();
  });

  it('passes null cursor on first run when no stored cursor exists', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    mockQueryEvents.mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
    });

    await processTick();

    expect(mockQueryEvents).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: null }),
    );
  });

  it('passes stored cursor from previous run', async () => {
    const storedCursor = JSON.stringify({ txDigest: '0xabc', eventSeq: '5' });
    mockFindFirst.mockResolvedValue({ id: 1, lastEventSeq: storedCursor });
    mockQueryEvents.mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
    });

    await processTick();

    // The stored cursor is JSON — the indexer should parse it before passing
    expect(mockQueryEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: JSON.parse(storedCursor),
      }),
    );
  });

  it('processes events and saves the next cursor', async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const fakeEvent = {
      id: { txDigest: '0xdigest1', eventSeq: '1' },
      type: '0xTEST_PKG::suiki::ProgramCreated',
      parsedJson: { program_id: '0xprog1' },
      timestampMs: '1700000000000',
    };

    const nextCursor = { txDigest: '0xdigest1', eventSeq: '1' };
    mockQueryEvents.mockResolvedValue({
      data: [fakeEvent],
      hasNextPage: false,
      nextCursor,
    });

    const result = await processTick();

    expect(result.processed).toBe(1);
    expect(result.hasMore).toBe(false);
    // Cursor should be saved as JSON string in lastEventSeq column
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        lastEventSeq: JSON.stringify(nextCursor),
      }),
    );
  });

  it('does not save cursor when no nextCursor is returned', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    mockQueryEvents.mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
    });

    await processTick();

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('continues processing when a single event handler throws', async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const { dispatchEvent } = await import('../handlers');
    (dispatchEvent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('handler boom'),
    );

    const events = [
      {
        id: { txDigest: '0xd1', eventSeq: '1' },
        type: '0xTEST_PKG::suiki::ProgramCreated',
        parsedJson: {},
        timestampMs: '1700000000000',
      },
      {
        id: { txDigest: '0xd2', eventSeq: '2' },
        type: '0xTEST_PKG::suiki::CardCreated',
        parsedJson: {},
        timestampMs: '1700000000001',
      },
    ];

    mockQueryEvents.mockResolvedValue({
      data: events,
      hasNextPage: false,
      nextCursor: { txDigest: '0xd2', eventSeq: '2' },
    });

    const result = await processTick();

    // First event fails, second succeeds — both are counted as "processed"
    // because the loop processes them; the error is logged but not re-thrown.
    expect(result.processed).toBe(1);
  });

  it('reports hasMore=true when there is a next page', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    mockQueryEvents.mockResolvedValue({
      data: [
        {
          id: { txDigest: '0xd1', eventSeq: '1' },
          type: '0xTEST_PKG::suiki::StampIssued',
          parsedJson: {},
          timestampMs: '1700000000000',
        },
      ],
      hasNextPage: true,
      nextCursor: { txDigest: '0xd1', eventSeq: '1' },
    });

    const result = await processTick();

    expect(result.hasMore).toBe(true);
  });

  it('skips unknown event types without throwing', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    mockQueryEvents.mockResolvedValue({
      data: [
        {
          id: { txDigest: '0xd1', eventSeq: '1' },
          type: '0xTEST_PKG::suiki::SomeUnknownEvent',
          parsedJson: {},
          timestampMs: '1700000000000',
        },
      ],
      hasNextPage: false,
      nextCursor: { txDigest: '0xd1', eventSeq: '1' },
    });

    // Should not throw
    const result = await processTick();

    // Unknown events hit the default branch but processed++ still runs (no error thrown)
    expect(result.processed).toBe(1);
  });
});
