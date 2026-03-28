/**
 * Unit tests for QR payload encoding/decoding utilities.
 *
 * Tests the functions in src/lib/qr-utils.ts:
 *   - encodeCustomerCardQR (walletAddress only — cardId removed to keep QR scannable)
 *   - encodeRewardClaimQR
 *   - decodeQRPayload
 *
 * All tests are pure unit tests — no DOM, no network, no SUI SDK required.
 * btoa/atob are available in Node.js 16+ and in all browser environments.
 */

import { describe, it, expect } from 'vitest';
import {
  encodeCustomerCardQR,
  encodeRewardClaimQR,
  decodeQRPayload,
} from '../qr-utils';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WALLET_ADDRESS = '0xwallet001aabbccddeeff';
const CARD_ID = '0xcard001aabbccddeeff';
const REWARD_ID = '0xprogram001aabbccddeeff';

// ---------------------------------------------------------------------------
// encodeCustomerCardQR
// ---------------------------------------------------------------------------

describe('encodeCustomerCardQR', () => {
  it('returns a string starting with the v1: version prefix', () => {
    const result = encodeCustomerCardQR(WALLET_ADDRESS);
    expect(result.startsWith('v1:')).toBe(true);
  });

  it('encodes walletAddress and type into the payload', () => {
    const encoded = encodeCustomerCardQR(WALLET_ADDRESS);
    const base64Part = encoded.slice('v1:'.length);
    const decoded = JSON.parse(atob(base64Part)) as Record<string, unknown>;

    expect(decoded['type']).toBe('card_scan');
    expect(decoded['walletAddress']).toBe(WALLET_ADDRESS);
  });

  it('does not include cardId in the payload (keeps QR density low)', () => {
    const encoded = encodeCustomerCardQR(WALLET_ADDRESS);
    const base64Part = encoded.slice('v1:'.length);
    const decoded = JSON.parse(atob(base64Part)) as Record<string, unknown>;
    expect(decoded['cardId']).toBeUndefined();
  });

  it('produces a stable output for the same inputs', () => {
    const first = encodeCustomerCardQR(WALLET_ADDRESS);
    const second = encodeCustomerCardQR(WALLET_ADDRESS);
    expect(first).toBe(second);
  });

  it('produces different outputs for different walletAddresses', () => {
    const a = encodeCustomerCardQR('0xwallet_a');
    const b = encodeCustomerCardQR('0xwallet_b');
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// encodeRewardClaimQR
// ---------------------------------------------------------------------------

describe('encodeRewardClaimQR', () => {
  it('returns a string starting with the v1: version prefix', () => {
    const result = encodeRewardClaimQR(CARD_ID, WALLET_ADDRESS, REWARD_ID);
    expect(result.startsWith('v1:')).toBe(true);
  });

  it('encodes cardId, walletAddress, and rewardId into the payload', () => {
    const encoded = encodeRewardClaimQR(CARD_ID, WALLET_ADDRESS, REWARD_ID);
    const base64Part = encoded.slice('v1:'.length);
    const decoded = JSON.parse(atob(base64Part)) as Record<string, unknown>;

    expect(decoded['type']).toBe('reward_claim');
    expect(decoded['cardId']).toBe(CARD_ID);
    expect(decoded['walletAddress']).toBe(WALLET_ADDRESS);
    expect(decoded['rewardId']).toBe(REWARD_ID);
  });

  it('differs from the card_scan encoding for the same wallet', () => {
    const cardScan = encodeCustomerCardQR(WALLET_ADDRESS);
    const rewardClaim = encodeRewardClaimQR(CARD_ID, WALLET_ADDRESS, REWARD_ID);
    expect(cardScan).not.toBe(rewardClaim);
  });
});

// ---------------------------------------------------------------------------
// decodeQRPayload — card_scan
// ---------------------------------------------------------------------------

describe('decodeQRPayload — card_scan', () => {
  it('decodes a card_scan payload produced by encodeCustomerCardQR', () => {
    const encoded = encodeCustomerCardQR(WALLET_ADDRESS);
    const result = decodeQRPayload(encoded);

    expect(result.type).toBe('card_scan');
    expect(result.walletAddress).toBe(WALLET_ADDRESS);
    expect(result.rewardId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// decodeQRPayload — reward_claim
// ---------------------------------------------------------------------------

describe('decodeQRPayload — reward_claim', () => {
  it('decodes a reward_claim payload produced by encodeRewardClaimQR', () => {
    const encoded = encodeRewardClaimQR(CARD_ID, WALLET_ADDRESS, REWARD_ID);
    const result = decodeQRPayload(encoded);

    expect(result.type).toBe('reward_claim');
    expect(result.cardId).toBe(CARD_ID);
    expect(result.walletAddress).toBe(WALLET_ADDRESS);
    expect(result.rewardId).toBe(REWARD_ID);
  });
});

// ---------------------------------------------------------------------------
// decodeQRPayload — unknown / error cases
// ---------------------------------------------------------------------------

describe('decodeQRPayload — unknown/error cases', () => {
  it('returns type "unknown" for an empty string', () => {
    expect(decodeQRPayload('').type).toBe('unknown');
  });

  it('returns type "unknown" for a string without the v1: prefix', () => {
    expect(decodeQRPayload('not-prefixed').type).toBe('unknown');
  });

  it('returns type "unknown" for a plain JSON string (no prefix)', () => {
    const json = JSON.stringify({ type: 'card_scan', walletAddress: WALLET_ADDRESS });
    expect(decodeQRPayload(json).type).toBe('unknown');
  });

  it('returns type "unknown" for invalid base64 after the prefix', () => {
    expect(decodeQRPayload('v1:!!!invalid-base64!!!').type).toBe('unknown');
  });

  it('returns type "unknown" for v1: prefix with non-JSON base64 content', () => {
    const payload = 'v1:' + btoa('this is not json');
    expect(decodeQRPayload(payload).type).toBe('unknown');
  });

  it('returns type "unknown" for a payload missing walletAddress', () => {
    const data = { type: 'card_scan' };
    const payload = 'v1:' + btoa(JSON.stringify(data));
    expect(decodeQRPayload(payload).type).toBe('unknown');
  });

  it('returns type "unknown" for a reward_claim payload missing rewardId', () => {
    const data = { type: 'reward_claim', cardId: CARD_ID, walletAddress: WALLET_ADDRESS };
    const payload = 'v1:' + btoa(JSON.stringify(data));
    expect(decodeQRPayload(payload).type).toBe('unknown');
  });

  it('returns type "unknown" for an unrecognised type in the payload', () => {
    const data = { type: 'merchant', programId: '0xabc', merchantAddress: '0xdef' };
    const payload = 'v1:' + btoa(JSON.stringify(data));
    expect(decodeQRPayload(payload).type).toBe('unknown');
  });

  it('returns type "unknown" when the decoded content is a JSON array', () => {
    const payload = 'v1:' + btoa(JSON.stringify(['card_scan', WALLET_ADDRESS]));
    expect(decodeQRPayload(payload).type).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// Round-trip integrity
// ---------------------------------------------------------------------------

describe('round-trip encode → decode integrity', () => {
  it('round-trips card_scan walletAddress without loss', () => {
    const encoded = encodeCustomerCardQR(WALLET_ADDRESS);
    const decoded = decodeQRPayload(encoded);

    expect(decoded.type).toBe('card_scan');
    expect(decoded.walletAddress).toBe(WALLET_ADDRESS);
  });

  it('round-trips reward_claim data without loss', () => {
    const original = { cardId: CARD_ID, walletAddress: WALLET_ADDRESS, rewardId: REWARD_ID };
    const encoded = encodeRewardClaimQR(original.cardId, original.walletAddress, original.rewardId);
    const decoded = decodeQRPayload(encoded);

    expect(decoded.type).toBe('reward_claim');
    expect(decoded.cardId).toBe(original.cardId);
    expect(decoded.walletAddress).toBe(original.walletAddress);
    expect(decoded.rewardId).toBe(original.rewardId);
  });
});
