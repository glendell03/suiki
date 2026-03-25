/**
 * On-chain query functions for reading Suiki contract state.
 *
 * These are plain async functions that accept a SuiClient (or compatible
 * interface) and return typed application-layer objects. They are intentionally
 * client-agnostic so they can be called from:
 *   - React hooks (useMyPrograms, useMyCards) via useSuiClient()
 *   - Next.js server components / route handlers via the suiClient singleton
 *   - Tests using a mock client
 *
 * Query strategy:
 *   getMerchantPrograms — queries ProgramCreated events filtered by merchant
 *     address, then fetches the live objects by ID (events give us IDs; live
 *     objects give us current field values).
 *   getCustomerCards — same pattern using CardCreated events filtered by customer.
 *   getProgramById — direct getObject call, no event query needed.
 *
 * Limitation: queryEvents only returns the most recent 50 events by default.
 * For production with many programs/cards, add cursor-based pagination.
 *
 * TODO: install @mysten/sui @mysten/dapp-kit
 * npm install @mysten/sui @mysten/dapp-kit @tanstack/react-query
 */

import type { SuiClientInterface } from './sui-client';
import type { StampProgram, StampCard, SuiRawStampProgram, SuiRawStampCard } from '../types/sui';
import { asSuiAddress, asSuiObjectId } from '../types/sui';
import { PACKAGE_ID, MODULE_NAME } from './constants';

// ---------------------------------------------------------------------------
// Internal parse helpers — RPC raw shapes → app types
// ---------------------------------------------------------------------------

/**
 * Parses raw RPC object content into a typed StampProgram.
 * Returns null if the content is missing or malformed, so callers can
 * filter out objects that failed to load (e.g., deleted or access-denied).
 *
 * @param objectId - The on-chain object ID.
 * @param content - Raw content from SuiClient.getObject / multiGetObjects.
 */
function parseStampProgram(
  objectId: string,
  content: unknown,
): StampProgram | null {
  if (!content || typeof content !== 'object') return null;

  // The RPC wraps fields in a `{ dataType: "moveObject", fields: {...} }` envelope.
  const envelope = content as { dataType?: string; fields?: unknown };
  if (envelope.dataType !== 'moveObject' || !envelope.fields) return null;

  const fields = envelope.fields as SuiRawStampProgram;

  // Guard against missing required fields.
  if (
    !fields.merchant ||
    !fields.name ||
    !fields.stamps_required ||
    !fields.reward_description
  ) {
    return null;
  }

  return {
    objectId: asSuiObjectId(objectId),
    merchant: asSuiAddress(fields.merchant),
    name: fields.name,
    logoUrl: fields.logo_url ?? '',
    stampsRequired: Number(fields.stamps_required),
    rewardDescription: fields.reward_description,
    totalIssued: Number(fields.total_issued ?? 0),
  };
}

/**
 * Parses raw RPC object content into a typed StampCard.
 * Returns null if the content is missing or malformed.
 *
 * @param objectId - The on-chain object ID.
 * @param content - Raw content from SuiClient.getObject / multiGetObjects.
 */
function parseStampCard(
  objectId: string,
  content: unknown,
): StampCard | null {
  if (!content || typeof content !== 'object') return null;

  const envelope = content as { dataType?: string; fields?: unknown };
  if (envelope.dataType !== 'moveObject' || !envelope.fields) return null;

  const fields = envelope.fields as SuiRawStampCard;

  if (!fields.program_id || !fields.customer || !fields.stamps_required) {
    return null;
  }

  return {
    objectId: asSuiObjectId(objectId),
    // program_id in the RPC response is already a plain hex string for ID fields.
    programId: asSuiObjectId(fields.program_id),
    customer: asSuiAddress(fields.customer),
    merchantName: fields.merchant_name ?? '',
    merchantLogo: fields.merchant_logo ?? '',
    stampsRequired: Number(fields.stamps_required),
    currentStamps: Number(fields.current_stamps ?? 0),
    totalEarned: Number(fields.total_earned ?? 0),
    lastStamped: Number(fields.last_stamped ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Internal event JSON shape
// ---------------------------------------------------------------------------

/**
 * Loose type for parsed Move event JSON payloads.
 * The RPC returns event fields as an untyped object; we cast selectively.
 */
interface EventParsedJson {
  program_id?: string;
  card_id?: string;
  merchant?: string;
  customer?: string;
  name?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Public query functions
// ---------------------------------------------------------------------------

/**
 * Fetches all StampPrograms created by a specific merchant address.
 *
 * Implementation:
 *   1. Query ProgramCreated events filtered by merchant address.
 *   2. Extract program_id from each event.
 *   3. Fetch live objects via multiGetObjects for current field values.
 *
 * @param client - A SuiClient instance (server or dapp-kit).
 * @param merchantAddress - The merchant's wallet address (0x-prefixed).
 * @returns Array of parsed StampPrograms. Empty array if none found.
 */
export async function getMerchantPrograms(
  client: SuiClientInterface,
  merchantAddress: string,
): Promise<StampProgram[]> {
  const events = await client.queryEvents({
    query: { MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::ProgramCreated` },
    order: 'descending',
    // TODO: add cursor pagination for merchants with many programs
  });

  const merchantEvents = events.data.filter(
    (e) => (e.parsedJson as EventParsedJson)?.merchant === merchantAddress,
  );

  if (merchantEvents.length === 0) return [];

  const programIds = merchantEvents
    .map((e) => (e.parsedJson as EventParsedJson).program_id)
    .filter((id): id is string => !!id);

  const rawObjects = await client.multiGetObjects({
    ids: programIds,
    options: { showContent: true },
  });

  return rawObjects
    .map((raw) => {
      if (!raw.data?.objectId) return null;
      return parseStampProgram(raw.data.objectId, raw.data.content);
    })
    .filter((p): p is StampProgram => p !== null);
}

/**
 * Fetches all StampCards owned by a specific customer address.
 *
 * Implementation:
 *   1. Query CardCreated events filtered by customer address.
 *   2. Extract card_id from each event.
 *   3. Fetch live objects via multiGetObjects for current stamp counts.
 *
 * Fetching live objects (not just event data) is important because
 * current_stamps changes with each stamp issuance and redemption.
 *
 * @param client - A SuiClient instance (server or dapp-kit).
 * @param customerAddress - The customer's wallet address (0x-prefixed).
 * @returns Array of parsed StampCards. Empty array if none found.
 */
export async function getCustomerCards(
  client: SuiClientInterface,
  customerAddress: string,
): Promise<StampCard[]> {
  const events = await client.queryEvents({
    query: { MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::CardCreated` },
    order: 'descending',
    // TODO: add cursor pagination for customers with many cards
  });

  const customerEvents = events.data.filter(
    (e) => (e.parsedJson as EventParsedJson)?.customer === customerAddress,
  );

  if (customerEvents.length === 0) return [];

  const cardIds = customerEvents
    .map((e) => (e.parsedJson as EventParsedJson).card_id)
    .filter((id): id is string => !!id);

  const rawObjects = await client.multiGetObjects({
    ids: cardIds,
    options: { showContent: true },
  });

  return rawObjects
    .map((raw) => {
      if (!raw.data?.objectId) return null;
      return parseStampCard(raw.data.objectId, raw.data.content);
    })
    .filter((c): c is StampCard => c !== null);
}

/**
 * Fetches a single StampProgram by its object ID.
 *
 * Use this when you already know the program ID (e.g., from scanning a
 * merchant QR code or navigating to a program detail page).
 *
 * @param client - A SuiClient instance (server or dapp-kit).
 * @param programId - The on-chain object ID of the StampProgram.
 * @returns The parsed StampProgram.
 * @throws Error if the object does not exist or cannot be parsed.
 */
export async function getProgramById(
  client: SuiClientInterface,
  programId: string,
): Promise<StampProgram> {
  const raw = await client.getObject({
    id: programId,
    options: { showContent: true },
  });

  if (!raw.data?.objectId) {
    throw new Error(`StampProgram not found: ${programId}`);
  }

  const program = parseStampProgram(raw.data.objectId, raw.data.content);

  if (!program) {
    throw new Error(
      `Failed to parse StampProgram fields for object: ${programId}. ` +
        'Check that the object is a suiki::suiki::StampProgram.',
    );
  }

  return program;
}

/**
 * Finds a customer's StampCard for a specific program ID, if one exists.
 *
 * Useful in the merchant's stamp-issuance flow: after scanning the customer's
 * QR, the app calls this to determine whether to use create_card_and_stamp
 * (new customer) or issue_stamp (existing card).
 *
 * @param client - A SuiClient instance.
 * @param programId - The StampProgram's object ID.
 * @param customerAddress - The customer's wallet address.
 * @returns The StampCard if found, null otherwise.
 */
export async function findCardForProgram(
  client: SuiClientInterface,
  programId: string,
  customerAddress: string,
): Promise<StampCard | null> {
  const events = await client.queryEvents({
    query: { MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::CardCreated` },
    order: 'descending',
  });

  const match = events.data.find((e) => {
    const json = e.parsedJson as EventParsedJson;
    return json?.program_id === programId && json?.customer === customerAddress;
  });

  if (!match) return null;

  const cardId = (match.parsedJson as EventParsedJson).card_id;
  if (!cardId) return null;

  const raw = await client.getObject({ id: cardId, options: { showContent: true } });

  if (!raw.data?.objectId) return null;

  return parseStampCard(raw.data.objectId, raw.data.content);
}
