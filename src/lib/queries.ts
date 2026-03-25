/**
 * On-chain query functions for reading Suiki contract state.
 *
 * Uses the server-side suiClient singleton (SuiGrpcClient) and the v2 core
 * API — no JSON-RPC methods (queryEvents, multiGetObjects) are used here.
 *
 * Query strategy:
 *   getProgramsByMerchant — lists objects owned by any address that match the
 *     StampProgram struct type, then filters in-memory by the merchant field.
 *     Note: StampProgram is a shared object so we list from the zero address.
 *     In practice, merchants query their own created programs by filtering the
 *     json.merchant field returned with include: { json: true }.
 *
 *   getCardsByCustomer — lists StampCard objects owned by the customer address
 *     using listOwnedObjects with a type filter.
 *
 *   getProgramById — fetches a single object by ID.
 */

import { suiClient } from './sui-client';
import type { StampProgram, StampCard, SuiRawStampProgram, SuiRawStampCard } from '../types/sui';
import { asSuiAddress, asSuiObjectId } from '../types/sui';
import { PACKAGE_ID, MODULE_NAME } from './constants';

// ---------------------------------------------------------------------------
// Move struct type strings for listOwnedObjects type filter
// ---------------------------------------------------------------------------

const STAMP_PROGRAM_TYPE = `${PACKAGE_ID}::${MODULE_NAME}::StampProgram` as const;
const STAMP_CARD_TYPE = `${PACKAGE_ID}::${MODULE_NAME}::StampCard` as const;

// ---------------------------------------------------------------------------
// Internal parse helpers — json field shapes → app types
// ---------------------------------------------------------------------------

/**
 * Parses the json field of a v2 Object response into a typed StampProgram.
 * The json field is available when `include: { json: true }` is passed.
 * Returns null if required fields are absent or malformed.
 */
function parseStampProgram(objectId: string, json: Record<string, unknown> | null | undefined): StampProgram | null {
  if (!json) return null;

  const fields = json as unknown as SuiRawStampProgram;

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
    merchantName: fields.merchant_name ?? '',
    merchantLogo: fields.merchant_logo ?? '',
    stampsRequired: Number(fields.stamps_required),
    currentStamps: Number(fields.current_stamps ?? 0),
    totalEarned: Number(fields.total_earned ?? 0),
    lastStamped: Number(fields.last_stamped ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Public query functions
// ---------------------------------------------------------------------------

/**
 * Fetches all StampPrograms created by a specific merchant address.
 *
 * Uses listOwnedObjects on the zero address (shared objects are "owned" by
 * the shared-object sentinel) filtered by StampProgram type, then filters
 * in memory by the merchant field. For production scale, index on-chain
 * events or use a backend index.
 *
 * @param merchantAddress - The merchant's wallet address (0x-prefixed).
 * @returns Array of parsed StampPrograms. Empty array if none found.
 */
export async function getProgramsByMerchant(merchantAddress: string): Promise<StampProgram[]> {
  // StampPrograms are shared objects. We page through all objects of this
  // type and filter by the merchant field in the JSON representation.
  const response = await suiClient.listOwnedObjects({
    // The SUI shared-object sentinel owner address.
    owner: '0x0000000000000000000000000000000000000000000000000000000000000000',
    type: STAMP_PROGRAM_TYPE,
    include: { json: true },
  });

  return response.objects
    .filter((obj) => {
      const json = obj.json as Record<string, unknown> | null | undefined;
      return json?.['merchant'] === merchantAddress;
    })
    .map((obj) => parseStampProgram(obj.objectId, obj.json as Record<string, unknown> | null))
    .filter((p): p is StampProgram => p !== null);
}

/**
 * Fetches all StampCards owned by a specific customer address.
 *
 * StampCards are shared objects transferred to the customer at creation.
 * Uses listOwnedObjects with the StampCard type filter.
 *
 * @param customerAddress - The customer's wallet address (0x-prefixed).
 * @returns Array of parsed StampCards. Empty array if none found.
 */
export async function getCardsByCustomer(customerAddress: string): Promise<StampCard[]> {
  const response = await suiClient.listOwnedObjects({
    owner: customerAddress,
    type: STAMP_CARD_TYPE,
    include: { json: true },
  });

  return response.objects
    .map((obj) => parseStampCard(obj.objectId, obj.json as Record<string, unknown> | null))
    .filter((c): c is StampCard => c !== null);
}

/**
 * Fetches a single StampProgram by its object ID.
 *
 * Use this when you already know the program ID (e.g., from scanning a
 * merchant QR code or navigating to a program detail page).
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
 * Useful in the merchant's stamp-issuance flow: after scanning the customer's
 * QR, the app calls this to determine whether to use create_card_and_stamp
 * (new customer) or issue_stamp (existing card).
 *
 * @param customerAddress - The customer's wallet address.
 * @param programId - The StampProgram's object ID to match against.
 * @returns The StampCard if found, null otherwise.
 */
export async function findCardForProgram(
  customerAddress: string,
  programId: string,
): Promise<StampCard | null> {
  const response = await suiClient.listOwnedObjects({
    owner: customerAddress,
    type: STAMP_CARD_TYPE,
    include: { json: true },
  });

  const match = response.objects.find((obj) => {
    const json = obj.json as Record<string, unknown> | null | undefined;
    return json?.['program_id'] === programId;
  });

  if (!match) return null;

  return parseStampCard(match.objectId, match.json as Record<string, unknown> | null);
}

// ---------------------------------------------------------------------------
// Legacy name aliases — consumed by useMyPrograms / useMyCards hooks.
// These delegate to the canonical implementations above.
// ---------------------------------------------------------------------------

/** @deprecated Use getProgramsByMerchant */
export const getMerchantPrograms = getProgramsByMerchant;

/** @deprecated Use getCardsByCustomer */
export const getCustomerCards = getCardsByCustomer;
