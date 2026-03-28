/**
 * Extended unit tests for QR encoding/decoding utilities in src/lib/qr-utils.ts.
 *
 * Tests the v1 versioned QR payload functions:
 *   - encodeCustomerCardQR(walletAddress) → "v1:" + base64(JSON)
 *     NOTE: cardId intentionally omitted to keep QR scannable (V10 vs V16)
 *   - encodeRewardClaimQR(cardId, walletAddress, rewardId) → "v1:" + base64(JSON)
 *   - decodeQRPayload(payload) → DecodedQRPayload
 *
 * Type discriminants:
 *   - card_scan   (encoded by encodeCustomerCardQR)
 *   - reward_claim (encoded by encodeRewardClaimQR)
 *   - unknown     (fallback for any invalid payload)
 *
 * All tests are pure unit tests — no DOM, no network, no SUI SDK required.
 */

import { describe, it, expect } from 'vitest';
import {
  encodeCustomerCardQR,
  encodeRewardClaimQR,
  decodeQRPayload,
} from '../qr-utils';
import type { DecodedQRPayload } from '../qr-utils';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A realistic-looking Sui object ID (66 chars, 0x-prefixed). */
const CARD_ID = '0xaaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666000011112222333344';

/** A realistic-looking Sui wallet address (66 chars, 0x-prefixed). */
const WALLET_ADDRESS = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';

/** A realistic-looking reward object ID for reward-claim payloads. */
const REWARD_ID = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef00';

// ---------------------------------------------------------------------------
// encodeCustomerCardQR
// ---------------------------------------------------------------------------

describe('encodeCustomerCardQR', () => {
  it('returns a string prefixed with "v1:"', () => {
    const result = encodeCustomerCardQR(WALLET_ADDRESS);
    expect(result.startsWith('v1:')).toBe(true);
  });

  it('returns a non-empty payload after the "v1:" prefix', () => {
    const result = encodeCustomerCardQR(WALLET_ADDRESS);
    const payload = result.slice('v1:'.length);
    expect(payload.length).toBeGreaterThan(0);
  });

  it('payload stays under 200 chars for max-length Sui addresses', () => {
    // cardId removed: payload is now ~143 chars vs ~247 chars with cardId.
    const maxWallet = '0x' + 'a'.repeat(64);
    const result = encodeCustomerCardQR(maxWallet);
    expect(result.length).toBeLessThan(200);
  });

  it('produces deterministic output — same inputs yield the same string', () => {
    const first = encodeCustomerCardQR(WALLET_ADDRESS);
    const second = encodeCustomerCardQR(WALLET_ADDRESS);
    expect(first).toBe(second);
  });

  it('produces different output for different wallet addresses', () => {
    const otherWallet = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const a = encodeCustomerCardQR(WALLET_ADDRESS);
    const b = encodeCustomerCardQR(otherWallet);
    expect(a).not.toBe(b);
  });

  it('encodes type card_scan and walletAddress in the JSON body', () => {
    const encoded = encodeCustomerCardQR(WALLET_ADDRESS);
    const body = JSON.parse(atob(encoded.slice('v1:'.length))) as Record<string, unknown>;
    expect(body['type']).toBe('card_scan');
    expect(body['walletAddress']).toBe(WALLET_ADDRESS);
  });

  it('does not include cardId in the payload (keeps QR version low)', () => {
    const encoded = encodeCustomerCardQR(WALLET_ADDRESS);
    const body = JSON.parse(atob(encoded.slice('v1:'.length))) as Record<string, unknown>;
    expect(body['cardId']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// encodeRewardClaimQR
// ---------------------------------------------------------------------------

describe('encodeRewardClaimQR', () => {
  it('returns a string prefixed with "v1:"', () => {
    const result = encodeRewardClaimQR(CARD_ID, WALLET_ADDRESS, REWARD_ID);
    expect(result.startsWith('v1:')).toBe(true);
  });

  it('returns a non-empty payload after the "v1:" prefix', () => {
    const result = encodeRewardClaimQR(CARD_ID, WALLET_ADDRESS, REWARD_ID);
    const payload = result.slice('v1:'.length);
    expect(payload.length).toBeGreaterThan(0);
  });

  it('payload stays under 500 chars for max-length Sui IDs', () => {
    const result = encodeRewardClaimQR(CARD_ID, WALLET_ADDRESS, REWARD_ID);
    expect(result.length).toBeLessThan(500);
  });

  it('produces deterministic output — same inputs yield the same string', () => {
    const first = encodeRewardClaimQR(CARD_ID, WALLET_ADDRESS, REWARD_ID);
    const second = encodeRewardClaimQR(CARD_ID, WALLET_ADDRESS, REWARD_ID);
    expect(first).toBe(second);
  });

  it('produces output distinct from encodeCustomerCardQR for the same wallet', () => {
    const customerCardEncoded = encodeCustomerCardQR(WALLET_ADDRESS);
    const rewardClaimEncoded = encodeRewardClaimQR(CARD_ID, WALLET_ADDRESS, REWARD_ID);
    expect(customerCardEncoded).not.toBe(rewardClaimEncoded);
  });

  it('produces different output for different reward IDs', () => {
    const otherRewardId = '0x1111111111111111111111111111111111111111111111111111111111111111';
    const a = encodeRewardClaimQR(CARD_ID, WALLET_ADDRESS, REWARD_ID);
    const b = encodeRewardClaimQR(CARD_ID, WALLET_ADDRESS, otherRewardId);
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// decodeQRPayload — card_scan type (produced by encodeCustomerCardQR)
// ---------------------------------------------------------------------------

describe('decodeQRPayload — card_scan type', () => {
  it('returns type "card_scan" after round-tripping encodeCustomerCardQR', () => {
    const encoded = encodeCustomerCardQR(WALLET_ADDRESS);
    const decoded = decodeQRPayload(encoded);
    expect(decoded.type).toBe('card_scan');
  });

  it('restores the original walletAddress from an encodeCustomerCardQR payload', () => {
    const encoded = encodeCustomerCardQR(WALLET_ADDRESS);
    const decoded = decodeQRPayload(encoded);
    expect(decoded.walletAddress).toBe(WALLET_ADDRESS);
  });

  it('round-trips encodeCustomerCardQR to the exact expected object shape', () => {
    const encoded = encodeCustomerCardQR(WALLET_ADDRESS);
    const decoded = decodeQRPayload(encoded);
    const expected: DecodedQRPayload = {
      type: 'card_scan',
      walletAddress: WALLET_ADDRESS,
    };
    expect(decoded).toEqual(expected);
  });

  it('rewardId is undefined in a card_scan payload', () => {
    const encoded = encodeCustomerCardQR(WALLET_ADDRESS);
    expect(decodeQRPayload(encoded).rewardId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// decodeQRPayload — reward_claim type (produced by encodeRewardClaimQR)
// ---------------------------------------------------------------------------

describe('decodeQRPayload — reward_claim type', () => {
  it('returns type "reward_claim" after round-tripping encodeRewardClaimQR', () => {
    const encoded = encodeRewardClaimQR(CARD_ID, WALLET_ADDRESS, REWARD_ID);
    const decoded = decodeQRPayload(encoded);
    expect(decoded.type).toBe('reward_claim');
  });

  it('restores all three fields from an encodeRewardClaimQR payload', () => {
    const encoded = encodeRewardClaimQR(CARD_ID, WALLET_ADDRESS, REWARD_ID);
    const decoded = decodeQRPayload(encoded);
    expect(decoded.cardId).toBe(CARD_ID);
    expect(decoded.walletAddress).toBe(WALLET_ADDRESS);
    expect(decoded.rewardId).toBe(REWARD_ID);
  });

  it('round-trips encodeRewardClaimQR to the exact expected object shape', () => {
    const encoded = encodeRewardClaimQR(CARD_ID, WALLET_ADDRESS, REWARD_ID);
    const decoded = decodeQRPayload(encoded);
    const expected: DecodedQRPayload = {
      type: 'reward_claim',
      cardId: CARD_ID,
      walletAddress: WALLET_ADDRESS,
      rewardId: REWARD_ID,
    };
    expect(decoded).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// decodeQRPayload — unknown / invalid inputs
// ---------------------------------------------------------------------------

describe('decodeQRPayload — invalid inputs', () => {
  it('returns { type: "unknown" } for a plain string with no prefix', () => {
    expect(decodeQRPayload('invalid')).toEqual({ type: 'unknown' });
  });

  it('returns { type: "unknown" } for an empty string', () => {
    expect(decodeQRPayload('')).toEqual({ type: 'unknown' });
  });

  it('returns { type: "unknown" } for a "v1:" prefix with no body', () => {
    expect(decodeQRPayload('v1:')).toEqual({ type: 'unknown' });
  });

  it('returns { type: "unknown" } for a "v1:" prefix with garbage base64 body', () => {
    expect(decodeQRPayload('v1:!!!not_valid!!!')).toEqual({ type: 'unknown' });
  });

  it('returns { type: "unknown" } for a v0: payload (unsupported version)', () => {
    expect(decodeQRPayload('v0:some_data')).toEqual({ type: 'unknown' });
  });

  it('returns { type: "unknown" } for raw JSON without a version prefix', () => {
    const rawJson = JSON.stringify({ type: 'merchant', programId: '0xabc', merchantAddress: '0xdef' });
    expect(decodeQRPayload(rawJson)).toEqual({ type: 'unknown' });
  });

  it('does not throw on very long garbage input', () => {
    const longGarbage = 'x'.repeat(10_000);
    expect(() => decodeQRPayload(longGarbage)).not.toThrow();
    expect(decodeQRPayload(longGarbage)).toEqual({ type: 'unknown' });
  });

  it('returns { type: "unknown" } for card_scan missing walletAddress', () => {
    const incomplete = 'v1:' + btoa(JSON.stringify({ type: 'card_scan' }));
    expect(decodeQRPayload(incomplete)).toEqual({ type: 'unknown' });
  });

  it('returns { type: "unknown" } for an unknown type discriminant', () => {
    const unknownType = 'v1:' + btoa(JSON.stringify({ type: 'purchase', amount: 100 }));
    expect(decodeQRPayload(unknownType)).toEqual({ type: 'unknown' });
  });
});

// ---------------------------------------------------------------------------
// Payload compactness
// ---------------------------------------------------------------------------

describe('payload compactness', () => {
  it('customer card payload is under 200 chars for max-length Sui addresses', () => {
    const maxWallet = '0x' + 'a'.repeat(64);
    expect(encodeCustomerCardQR(maxWallet).length).toBeLessThan(200);
  });

  it('reward claim payload stays under 500 chars for max-length Sui IDs', () => {
    const maxCardId = '0x' + 'f'.repeat(64);
    const maxWallet = '0x' + 'a'.repeat(64);
    const maxRewardId = '0x' + 'b'.repeat(64);
    expect(encodeRewardClaimQR(maxCardId, maxWallet, maxRewardId).length).toBeLessThan(500);
  });
});
