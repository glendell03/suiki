/**
 * On-chain query functions for reading Suiki contract state.
 *
 * Query strategy:
 *   StampProgram and StampCard are both SHARED objects (transfer::share_object).
 *   Shared objects have no owner and cannot be found via listOwnedObjects.
 *   Instead, we query the on-chain events emitted at creation time:
 *
 *   getProgramsByMerchant — queries ProgramCreated events filtered by
 *     Sender == merchantAddress, extracts the program_id from each event,
 *     then batch-fetches the live object state via suiClient.getObjects().
 *
 *   getCardsByCustomer — queries CardCreated events filtered by MoveEventType,
 *     filters in memory for events where parsedJson.customer == customerAddress,
 *     then batch-fetches the live object state.
 *
 * Event queries use SuiJsonRpcClient (suix_queryEvents RPC method) because the
 * gRPC client does not expose an event-query surface. Object reads use the
 * gRPC suiClient singleton for efficiency.
 */

import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { suiClient } from './sui-client';
import type { StampProgram, StampCard, SuiRawStampProgram, SuiRawStampCard } from '../types/sui';
import { asSuiAddress, asSuiObjectId } from '../types/sui';
import { PACKAGE_ID, MODULE_NAME, EVENT_TYPES, SUI_NETWORK } from './constants';

// ---------------------------------------------------------------------------
// JSON-RPC client — event queries only
// ---------------------------------------------------------------------------

/**
 * Lightweight JSON-RPC client used exclusively for suix_queryEvents.
 * The gRPC suiClient handles all object reads and transaction execution.
 */
const jsonRpcClient = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl(SUI_NETWORK),
  network: SUI_NETWORK,
});

// ---------------------------------------------------------------------------
// Move struct type strings
// ---------------------------------------------------------------------------

const STAMP_PROGRAM_TYPE = `${PACKAGE_ID}::${MODULE_NAME}::StampProgram` as const;
const STAMP_CARD_TYPE = `${PACKAGE_ID}::${MODULE_NAME}::StampCard` as const;

// ---------------------------------------------------------------------------
// Internal parse helpers — object json fields → app types
// ---------------------------------------------------------------------------

/**
 * Parses the json field of a v2 Object response into a typed StampProgram.
 * Returns null if required fields are absent or malformed.
 */
function parseStampProgram(objectId: string, json: Record<string, unknown> | null | undefined): StampProgram | null {
  if (!json) return null;

  const fields = json as unknown as SuiRawStampProgram;

  if (
    !fields.merchant ||
    !fields.name ||
    !fields.stamps_required
  ) {
    return null;
  }

  return {
    objectId: asSuiObjectId(objectId),
    merchant: asSuiAddress(fields.merchant),
    name: fields.name,
    stampsRequired: Number(fields.stamps_required),
    totalIssued: Number(fields.total_issued ?? 0),
    version: Number((fields as Record<string, unknown>)['version'] ?? 0),
    isActive: Boolean((fields as Record<string, unknown>)['is_active'] ?? true),
  };
}

/**
 * Parses the json field of a v2 Object response into a typed StampCard.
 * Returns null if required fields are absent or malformed.
 */
function parseStampCard(objectId: string, json: Record<string, unknown> | null | undefined): StampCard | null {
  if (!json) return null;

  const fields = json as unknown as SuiRawStampCard;

  if (!fields.program_id || !fields.customer || !fields.stamps_required) {
    return null;
  }

  return {
    objectId: asSuiObjectId(objectId),
    programId: asSuiObjectId(fields.program_id),
    customer: asSuiAddress(fields.customer),
    stampsRequired: Number(fields.stamps_required),
    currentStamps: Number(fields.current_stamps ?? 0),
    totalEarned: Number(fields.total_earned ?? 0),
    lastStamped: Number(fields.last_stamped ?? 0),
    version: Number((fields as Record<string, unknown>)['version'] ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Public query functions
// ---------------------------------------------------------------------------

/**
 * Fetches all StampPrograms created by a specific merchant address.
 *
 * Flow:
 *  1. Query ProgramCreated events filtered by Sender == merchantAddress.
 *  2. Extract program_id from each event's parsedJson.
 *  3. Batch-fetch live object state via suiClient.getObjects().
 *
 * @param merchantAddress - The merchant's wallet address (0x-prefixed).
 * @returns Array of parsed StampPrograms. Empty array if none found.
 */
export async function getProgramsByMerchant(merchantAddress: string): Promise<StampProgram[]> {
  // Step 1: query events where tx sender == merchantAddress, then filter by type.
  // Sui indexes events by sender — this is an efficient indexed query.
  // There is no AND compound filter in queryEvents; we filter by type in memory.
  const events = await jsonRpcClient.queryEvents({
    query: { Sender: merchantAddress },
    order: 'descending',
    limit: 50,
  });

  // Step 2: extract program object IDs from ProgramCreated events only.
  const programIds = events.data
    .filter((event) => event.type === EVENT_TYPES.programCreated)
    .map((event) => {
      const json = event.parsedJson as Record<string, unknown> | undefined;
      return json?.['program_id'];
    })
    .filter((id): id is string => typeof id === 'string');

  if (programIds.length === 0) return [];

  // Step 3: batch-fetch live object state (versions, fields) via gRPC.
  const objectsResult = await suiClient.getObjects({
    objectIds: programIds,
    include: { json: true },
  });

  return objectsResult.objects
    .map((obj) => parseStampProgram(obj.objectId, obj.json as Record<string, unknown> | null))
    .filter((p): p is StampProgram => p !== null);
}

/**
 * Fetches all StampCards for a specific customer address.
 *
 * Flow:
 *  1. Query CardCreated events filtered by MoveEventType (cards for any customer).
 *  2. Filter in memory for events where parsedJson.customer == customerAddress.
 *  3. Batch-fetch live object state via suiClient.getObjects().
 *
 * Note: StampCards are shared objects emitted by the merchant's transaction.
 * The Sender filter would return cards the customer created themselves
 * (not applicable), so we filter on the event data field instead.
 *
 * @param customerAddress - The customer's wallet address (0x-prefixed).
 * @returns Array of parsed StampCards. Empty array if none found.
 */
export async function getCardsByCustomer(customerAddress: string): Promise<StampCard[]> {
  // Step 1: query all CardCreated events of this package/module.
  const events = await jsonRpcClient.queryEvents({
    query: { MoveEventType: EVENT_TYPES.cardCreated },
    order: 'descending',
    limit: 50,
  });

  // Step 2: filter by customer address in event data.
  const cardIds = events.data
    .filter((event) => {
      const json = event.parsedJson as Record<string, unknown> | undefined;
      return json?.['customer'] === customerAddress;
    })
    .map((event) => {
      const json = event.parsedJson as Record<string, unknown> | undefined;
      return json?.['card_id'];
    })
    .filter((id): id is string => typeof id === 'string');

  if (cardIds.length === 0) return [];

  // Step 3: batch-fetch live object state via gRPC.
  const objectsResult = await suiClient.getObjects({
    objectIds: cardIds,
    include: { json: true },
  });

  return objectsResult.objects
    .map((obj) => parseStampCard(obj.objectId, obj.json as Record<string, unknown> | null))
    .filter((c): c is StampCard => c !== null);
}

/**
 * Fetches a single StampProgram by its object ID.
 *
 * @param programId - The on-chain object ID of the StampProgram.
 * @returns The parsed StampProgram, or null if not found or parse fails.
 */
export async function getProgramById(programId: string): Promise<StampProgram | null> {
  const response = await suiClient.getObject({
    objectId: programId,
    include: { json: true },
  });

  const obj = response.object;
  return parseStampProgram(obj.objectId, obj.json as Record<string, unknown> | null);
}

/**
 * Finds a customer's StampCard for a specific program ID, if one exists.
 *
 * @param customerAddress - The customer's wallet address.
 * @param programId - The StampProgram's object ID to match against.
 * @returns The StampCard if found, null otherwise.
 */
export async function findCardForProgram(
  customerAddress: string,
  programId: string,
): Promise<StampCard | null> {
  const cards = await getCardsByCustomer(customerAddress);
  return cards.find((c) => c.programId === programId) ?? null;
}

// ---------------------------------------------------------------------------
// Legacy name aliases — consumed by useMyPrograms / useMyCards hooks.
// ---------------------------------------------------------------------------

/** @deprecated Use getProgramsByMerchant */
export const getMerchantPrograms = getProgramsByMerchant;

/** @deprecated Use getCardsByCustomer */
export const getCustomerCards = getCardsByCustomer;
