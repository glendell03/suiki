/**
 * QR code payload parsing and encoding utilities for Suiki.
 *
 * ## Encoding formats
 *
 * ### v2 (current) — binary, compact
 *   `v2:` + base64url(bytes)
 *
 *   card_scan   : [0x00] + wallet(32 bytes)              = 33 bytes → 47 chars total
 *   reward_claim: [0x01] + cardId(32) + wallet(32) + rewardId(32) = 97 bytes → 133 chars total
 *
 *   vs v1 JSON which was ~143 chars / ~360 chars respectively.
 *   QR version drops from v10→v3 (card_scan) and v22→v9 (reward_claim).
 *
 * ### v1 (legacy) — JSON base64
 *   `v1:` + btoa(JSON.stringify(data))
 *   Decoder retained for backwards compatibility.
 */

import type { MerchantQRPayload, CustomerQRPayload, QRPayload, SuiObjectId, SuiAddress } from '@/types/sui';

// ---------------------------------------------------------------------------
// Internal encoded payload shapes (v1 legacy)
// ---------------------------------------------------------------------------

interface CardScanPayloadData {
  type: 'card_scan';
  walletAddress: string;
}

interface RewardClaimPayloadData {
  type: 'reward_claim';
  cardId: string;
  walletAddress: string;
  rewardId: string;
}

/** Decoded QR payload result for merchant-scanner consumption. */
export interface DecodedQRPayload {
  type: 'card_scan' | 'reward_claim' | 'unknown';
  cardId?: string;
  walletAddress?: string;
  rewardId?: string;
}

// ---------------------------------------------------------------------------
// v2 binary encoding constants
// ---------------------------------------------------------------------------

const V2_TYPE_CARD_SCAN = 0;
const V2_TYPE_REWARD_CLAIM = 1;
const SUI_ADDR_BYTES = 32;

// ---------------------------------------------------------------------------
// v2 binary helpers
// ---------------------------------------------------------------------------

/** Convert a 0x-prefixed 64-hex-char Sui address to a 32-byte Uint8Array. */
function hexAddressToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length !== 64) {
    throw new Error(`Invalid Sui address length: expected 64 hex chars, got ${clean.length}`);
  }
  const bytes = new Uint8Array(SUI_ADDR_BYTES);
  for (let i = 0; i < SUI_ADDR_BYTES; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Convert a 32-byte Uint8Array to a 0x-prefixed lowercase hex address. */
function bytesToHexAddress(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/** Encode bytes as URL-safe base64 without padding. */
function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode a URL-safe base64 string (with or without padding) to bytes. */
function base64urlToBytes(s: string): Uint8Array {
  const standard = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ---------------------------------------------------------------------------
// Public QR payload parsing (legacy merchant JSON format)
// ---------------------------------------------------------------------------

/**
 * Parse a raw QR code string into a typed QRPayload.
 * Used by the merchant scanner to read merchant QR codes (JSON format).
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
// v2 compact binary QR encoding — customer-facing QR codes
// ---------------------------------------------------------------------------

/**
 * Encode a customer card scan payload using compact v2 binary format.
 *
 * Format: `v2:` + base64url([0x00] + wallet_bytes(32))
 * Total length: 47 chars — drops from QR version 10 to version 3.
 *
 * @param walletAddress - 0x-prefixed 32-byte Sui address (64 hex chars).
 */
export function encodeCustomerCardQR(walletAddress: string): string {
  const walletBytes = hexAddressToBytes(walletAddress);
  const buf = new Uint8Array(1 + SUI_ADDR_BYTES);
  buf[0] = V2_TYPE_CARD_SCAN;
  buf.set(walletBytes, 1);
  return 'v2:' + bytesToBase64url(buf);
}

/**
 * Encode a reward claim payload using compact v2 binary format.
 *
 * Format: `v2:` + base64url([0x01] + cardId(32) + wallet(32) + rewardId(32))
 * Total length: 133 chars — drops from QR version 22 to version 9.
 *
 * @param cardId        - On-chain StampCard object ID.
 * @param walletAddress - Customer's 0x-prefixed Sui address.
 * @param rewardId      - Reward identifier (program ID).
 */
export function encodeRewardClaimQR(cardId: string, walletAddress: string, rewardId: string): string {
  const cardBytes = hexAddressToBytes(cardId);
  const walletBytes = hexAddressToBytes(walletAddress);
  const rewardBytes = hexAddressToBytes(rewardId);
  const buf = new Uint8Array(1 + SUI_ADDR_BYTES * 3);
  buf[0] = V2_TYPE_REWARD_CLAIM;
  buf.set(cardBytes, 1);
  buf.set(walletBytes, 1 + SUI_ADDR_BYTES);
  buf.set(rewardBytes, 1 + SUI_ADDR_BYTES * 2);
  return 'v2:' + bytesToBase64url(buf);
}

// ---------------------------------------------------------------------------
// Decoder — handles both v2 (binary) and v1 (JSON legacy)
// ---------------------------------------------------------------------------

/**
 * Decode a compact QR payload back to its original data.
 *
 * Supports:
 * - v2: binary format (current)
 * - v1: JSON base64 format (legacy backwards-compat)
 *
 * Returns `{ type: 'unknown' }` for unrecognised or malformed inputs.
 */
export function decodeQRPayload(payload: string): DecodedQRPayload {
  if (!payload) return { type: 'unknown' };

  if (payload.startsWith('v2:')) return decodeV2(payload.slice(3));
  if (payload.startsWith('v1:')) return decodeV1(payload.slice(3));

  return { type: 'unknown' };
}

function decodeV2(encoded: string): DecodedQRPayload {
  try {
    const bytes = base64urlToBytes(encoded);
    const msgType = bytes[0];

    if (msgType === V2_TYPE_CARD_SCAN && bytes.length === 1 + SUI_ADDR_BYTES) {
      return {
        type: 'card_scan',
        walletAddress: bytesToHexAddress(bytes.slice(1, 1 + SUI_ADDR_BYTES)),
      };
    }

    if (msgType === V2_TYPE_REWARD_CLAIM && bytes.length === 1 + SUI_ADDR_BYTES * 3) {
      return {
        type: 'reward_claim',
        cardId: bytesToHexAddress(bytes.slice(1, 1 + SUI_ADDR_BYTES)),
        walletAddress: bytesToHexAddress(bytes.slice(1 + SUI_ADDR_BYTES, 1 + SUI_ADDR_BYTES * 2)),
        rewardId: bytesToHexAddress(bytes.slice(1 + SUI_ADDR_BYTES * 2, 1 + SUI_ADDR_BYTES * 3)),
      };
    }

    return { type: 'unknown' };
  } catch {
    return { type: 'unknown' };
  }
}

function decodeV1(encoded: string): DecodedQRPayload {
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
    return { type: 'card_scan', walletAddress: String(walletAddress) };
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
