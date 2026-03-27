import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { db } from '@/lib/db';
import { indexerCursor } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { PACKAGE_ID, MODULE_NAME, EVENT_TYPES, SUI_NETWORK } from '@/lib/constants';
import {
  handleProgramCreated,
  handleProgramUpdated,
  handleProgramDeactivated,
  handleProgramReactivated,
  handleCardCreated,
  handleStampIssued,
  handleStampRedeemed,
  handleStafferCapCreated,
} from './handlers';

/** Singleton cursor row ID — only one row ever exists. */
const CURSOR_ROW_ID = 1;

/** Maximum events to fetch per tick. Keeps each invocation short for Vercel Cron. */
const PAGE_LIMIT = 50;

/** Lazily-initialized JSON-RPC client. Avoids module-scope side effects in tests. */
let _rpcClient: SuiJsonRpcClient | null = null;

function getRpcClient(): SuiJsonRpcClient {
  if (!_rpcClient) {
    _rpcClient = new SuiJsonRpcClient({
      url: getJsonRpcFullnodeUrl(SUI_NETWORK),
      network: SUI_NETWORK,
    });
  }
  return _rpcClient;
}

/**
 * Reads the stored event cursor from the database.
 * Returns the parsed cursor object, or undefined on first run.
 */
async function getStoredCursor(): Promise<string | undefined> {
  const row = await db.query.indexerCursor.findFirst({
    where: eq(indexerCursor.id, CURSOR_ROW_ID),
  });
  return row?.lastEventSeq ?? undefined;
}

/**
 * Persists the event cursor so the next tick resumes from where we left off.
 * Uses upsert to handle both initial insert and subsequent updates.
 */
async function saveCursor(cursor: string): Promise<void> {
  await db
    .insert(indexerCursor)
    .values({ id: CURSOR_ROW_ID, lastEventSeq: cursor, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: indexerCursor.id,
      set: { lastEventSeq: cursor, updatedAt: new Date() },
    });
}

/**
 * Processes one page of Sui Move events from the suiki module.
 *
 * Reads the stored cursor, fetches up to PAGE_LIMIT events, dispatches each
 * to the appropriate handler, then advances the cursor. Handler errors are
 * logged but do not halt the tick — other events continue processing.
 *
 * @returns The number of successfully processed events and whether more pages remain.
 */
export async function processTick(): Promise<{ processed: number; hasMore: boolean }> {
  const storedCursor = await getStoredCursor();
  const parsedCursor = storedCursor ? JSON.parse(storedCursor) : null;

  const result = await getRpcClient().queryEvents({
    query: { MoveModule: { package: PACKAGE_ID, module: MODULE_NAME } },
    cursor: parsedCursor as never,
    limit: PAGE_LIMIT,
    order: 'ascending',
  });

  const events = result.data;
  let processed = 0;

  for (const event of events) {
    const txDigest = event.id.txDigest;
    const payload = event.parsedJson as Record<string, unknown>;
    const timestampMs = event.timestampMs ? Number(event.timestampMs) : Date.now();
    const eventDate = new Date(timestampMs);

    try {
      switch (event.type) {
        case EVENT_TYPES.programCreated:
          await handleProgramCreated(txDigest, payload as never);
          break;
        case EVENT_TYPES.programUpdated:
          await handleProgramUpdated(txDigest, payload as never);
          break;
        case EVENT_TYPES.programDeactivated:
          await handleProgramDeactivated(txDigest, payload as never);
          break;
        case EVENT_TYPES.programReactivated:
          await handleProgramReactivated(txDigest, payload as never);
          break;
        case EVENT_TYPES.cardCreated:
          await handleCardCreated(txDigest, payload as never);
          break;
        case EVENT_TYPES.stampIssued:
          await handleStampIssued(txDigest, payload as never);
          break;
        case EVENT_TYPES.stampRedeemed:
          await handleStampRedeemed(txDigest, payload as never, eventDate);
          break;
        case EVENT_TYPES.stafferCapCreated:
          await handleStafferCapCreated(txDigest, payload as never);
          break;
        default:
          // Unknown event type from this package — skip silently.
          break;
      }
      processed++;
    } catch (err) {
      console.error(`[indexer] Error processing ${event.type} tx=${txDigest}:`, err);
      // Continue processing remaining events rather than halting the whole tick.
    }
  }

  // Advance cursor past the processed page.
  if (result.nextCursor) {
    await saveCursor(JSON.stringify(result.nextCursor));
  }

  return { processed, hasMore: result.hasNextPage };
}
