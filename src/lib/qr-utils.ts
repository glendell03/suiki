/**
 * QR code payload parsing and encoding utilities for Suiki.
 *
 * Merchant QR codes encode a MerchantQRPayload (type: 'merchant').
 * Customer QR codes encode a CustomerQRPayload (type: 'customer').
 * Card scan QR codes encode a card_scan payload (used by card detail page).
 * Reward claim QR codes encode a reward_claim payload (used by reward claim page).
 *
 * All payload shapes are defined in src/types/sui.ts as the QRPayload union.
 *
 * Encoding format for compact QR payloads:
 *   `v1:` + btoa(JSON.stringify(data))
 *
 * This version prefix allows future encoding changes while remaining backwards compatible.
 */

import type { MerchantQRPayload, CustomerQRPayload, QRPayload, SuiObjectId, SuiAddress } from '@/types/sui';

// ---------------------------------------------------------------------------
// Internal encoded payload shapes
// ---------------------------------------------------------------------------

interface CardScanPayloadData {
  type: 'card_scan';
  // cardId intentionally omitted — adds 66 chars and the merchant scanner
  // never uses it (it calls findCardForProgram(walletAddress, programId)).
  // Keeping the payload small avoids a high-density QR that scanners struggle with.
  walletAddress: string;
}

interface RewardClaimPayloadData {
  type: 'reward_claim';
  cardId: string;
  walletAddress: string;
  rewardId: string;
}

type EncodedPayloadData = CardScanPayloadData | RewardClaimPayloadData;

/** Decoded QR payload result for merchant-scanner consumption. */
export interface DecodedQRPayload {
  type: 'card_scan' | 'reward_claim' | 'unknown';
  cardId?: string;
  walletAddress?: string;
  rewardId?: string;
}

/**
 * Parse a raw QR code string into a typed QRPayload.
 *
 * Returns null when:
 * - The string is not valid JSON
 * - The parsed value is not an object
 * - The `type` field is not 'merchant' or 'customer'
 * - Required fields for the given type are missing or empty
 *
 * All field values are coerced to strings via String() to prevent
 * prototype-pollution or object-injection attacks.
 *
 * @param raw - The raw string scanned from a QR code.
 * @returns A typed QRPayload or null on parse failure.
 */
export function parseQRPayload(raw: string): QRPayload | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  if (obj['type'] === 'merchant') {
    const programId = obj['programId'];
    const merchantAddress = obj['merchantAddress'];

    if (!programId || !merchantAddress) return null;

    // String() coercion guards against object-injection where a field value
    // is itself an object rather than a primitive string.
    const payload: MerchantQRPayload = {
      type: 'merchant',
      programId: String(programId) as SuiObjectId,
      merchantAddress: String(merchantAddress) as SuiAddress,
    };
    return payload;
  }

  if (obj['type'] === 'customer') {
    const customerAddress = obj['customerAddress'];

    if (!customerAddress) return null;

    const payload: CustomerQRPayload = {
      type: 'customer',
      customerAddress: String(customerAddress) as SuiAddress,
    };
    return payload;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Compact base64 QR encoding — for customer-facing QR codes
// ---------------------------------------------------------------------------

const QR_VERSION_PREFIX = 'v1:' as const;

/**
 * Encode a customer card scan event as a compact QR payload.
 *
 * Used by the customer's card detail page. The merchant scanner decodes
 * this payload to identify who to stamp (via walletAddress + programId).
 *
 * Encoding: `v1:` + btoa(JSON.stringify({ type, walletAddress }))
 *
 * NOTE: cardId is intentionally not encoded — the merchant scanner derives
 * the card via findCardForProgram(walletAddress, programId). Omitting it
 * keeps the payload ~100 bytes shorter, dropping from QR Version 16
 * (81×81, barely scannable) to Version 10 (57×57, easily scannable).
 *
 * @param walletAddress - The customer's wallet address (0x-prefixed).
 * @returns A compact base64-encoded string suitable for QR display.
 */
export function encodeCustomerCardQR(walletAddress: string): string {
  const data: CardScanPayloadData = { type: 'card_scan', walletAddress };
  return QR_VERSION_PREFIX + btoa(JSON.stringify(data));
}

/**
 * Encode a reward claim event as a compact QR payload.
 *
 * Used by the reward claim page — the merchant scans this to confirm
 * the reward redemption on-chain.
 *
 * Encoding: `v1:` + btoa(JSON.stringify({ type, cardId, walletAddress, rewardId }))
 *
 * @param cardId - The on-chain StampCard object ID.
 * @param walletAddress - The customer's wallet address (0x-prefixed).
 * @param rewardId - The reward identifier (e.g. programId used as reward reference).
 * @returns A compact base64-encoded string suitable for QR display.
 */
export function encodeRewardClaimQR(cardId: string, walletAddress: string, rewardId: string): string {
  const data: RewardClaimPayloadData = { type: 'reward_claim', cardId, walletAddress, rewardId };
  return QR_VERSION_PREFIX + btoa(JSON.stringify(data));
}

/**
 * Decode a compact QR payload back to its original data.
 *
 * Handles the v1 prefix format produced by encodeCustomerCardQR and
 * encodeRewardClaimQR. Returns type 'unknown' for unrecognised or
 * malformed inputs without throwing.
 *
 * Used by the merchant scanner to determine what action to take.
 *
 * @param payload - The raw string from a scanned QR code.
 * @returns A DecodedQRPayload with at minimum a `type` field.
 */
export function decodeQRPayload(payload: string): DecodedQRPayload {
  if (!payload || !payload.startsWith(QR_VERSION_PREFIX)) {
    return { type: 'unknown' };
  }

  const encoded = payload.slice(QR_VERSION_PREFIX.length);

  let parsed: unknown;
  try {
    parsed = JSON.parse(atob(encoded));
  } catch {
    return { type: 'unknown' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { type: 'unknown' };
  }

  const obj = parsed as Record<string, unknown>;

  if (obj['type'] === 'card_scan') {
    const walletAddress = obj['walletAddress'];

    if (!walletAddress) return { type: 'unknown' };

    return {
      type: 'card_scan',
      walletAddress: String(walletAddress),
    };
  }

  if (obj['type'] === 'reward_claim') {
    const cardId = obj['cardId'];
    const walletAddress = obj['walletAddress'];
    const rewardId = obj['rewardId'];

    if (!cardId || !walletAddress || !rewardId) return { type: 'unknown' };

    return {
      type: 'reward_claim',
      cardId: String(cardId),
      walletAddress: String(walletAddress),
      rewardId: String(rewardId),
    };
  }

  return { type: 'unknown' };
}
