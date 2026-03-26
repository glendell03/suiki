/**
 * Unit tests for QR payload parsing logic.
 *
 * The parseQRPayload function is defined inline here so this file acts as
 * a self-contained specification. The canonical implementation lives in
 * src/lib/qr-utils.ts and imports QRPayload from src/types/sui.ts.
 *
 * Tests are pure unit tests — no DOM, no network, no SUI SDK required.
 */

import { describe, it, expect } from 'vitest';
import type { MerchantQRPayload, CustomerQRPayload } from '../../types/sui';
import { parseQRPayload } from '../qr-utils';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MERCHANT_PAYLOAD: MerchantQRPayload = {
  type: 'merchant',
  programId: '0xabc123' as MerchantQRPayload['programId'],
  merchantAddress: '0xdef456' as MerchantQRPayload['merchantAddress'],
};

const CUSTOMER_PAYLOAD: CustomerQRPayload = {
  type: 'customer',
  customerAddress: '0xcustomer789' as CustomerQRPayload['customerAddress'],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseQRPayload', () => {
  // ------------------------------------------------------------------
  // Happy paths
  // ------------------------------------------------------------------

  it('returns MerchantQRPayload for a valid merchant JSON string', () => {
    const raw = JSON.stringify(MERCHANT_PAYLOAD);
    const result = parseQRPayload(raw);

    expect(result).toEqual({
      type: 'merchant',
      programId: '0xabc123',
      merchantAddress: '0xdef456',
    });
  });

  it('returns CustomerQRPayload for a valid customer JSON string', () => {
    const raw = JSON.stringify(CUSTOMER_PAYLOAD);
    const result = parseQRPayload(raw);

    expect(result).toEqual({
      type: 'customer',
      customerAddress: '0xcustomer789',
    });
  });

  // ------------------------------------------------------------------
  // Invalid JSON
  // ------------------------------------------------------------------

  it('returns null for invalid JSON', () => {
    expect(parseQRPayload('not-json')).toBe(null);
  });

  it('returns null for empty string', () => {
    expect(parseQRPayload('')).toBe(null);
  });

  it('returns null for a JSON string (primitive, not object)', () => {
    expect(parseQRPayload('"just a string"')).toBe(null);
  });

  it('returns null for a JSON number', () => {
    expect(parseQRPayload('42')).toBe(null);
  });

  it('returns null for a JSON array', () => {
    expect(parseQRPayload('["merchant","0xabc"]')).toBe(null);
  });

  // ------------------------------------------------------------------
  // Unknown / wrong type
  // ------------------------------------------------------------------

  it('returns null when type is an unknown value', () => {
    const raw = JSON.stringify({ type: 'shop', programId: '0xabc', merchantAddress: '0xdef' });
    expect(parseQRPayload(raw)).toBe(null);
  });

  it('returns null when type field is absent', () => {
    const raw = JSON.stringify({ programId: '0xabc', merchantAddress: '0xdef' });
    expect(parseQRPayload(raw)).toBe(null);
  });

  // ------------------------------------------------------------------
  // Missing required fields
  // ------------------------------------------------------------------

  it('returns null for merchant payload missing programId', () => {
    const raw = JSON.stringify({ type: 'merchant', merchantAddress: '0xdef456' });
    expect(parseQRPayload(raw)).toBe(null);
  });

  it('returns null for merchant payload missing merchantAddress', () => {
    const raw = JSON.stringify({ type: 'merchant', programId: '0xabc123' });
    expect(parseQRPayload(raw)).toBe(null);
  });

  it('returns null for customer payload missing customerAddress', () => {
    const raw = JSON.stringify({ type: 'customer' });
    expect(parseQRPayload(raw)).toBe(null);
  });

  it('returns null for merchant payload with empty programId', () => {
    const raw = JSON.stringify({ type: 'merchant', programId: '', merchantAddress: '0xdef456' });
    expect(parseQRPayload(raw)).toBe(null);
  });

  it('returns null for merchant payload with empty merchantAddress', () => {
    const raw = JSON.stringify({ type: 'merchant', programId: '0xabc123', merchantAddress: '' });
    expect(parseQRPayload(raw)).toBe(null);
  });

  // ------------------------------------------------------------------
  // XSS / injection attempts
  // ------------------------------------------------------------------

  it('returns null for a script-tag XSS payload disguised as JSON', () => {
    // This is not valid JSON so parseQRPayload must return null.
    const xss = '<script>alert(1)</script>';
    expect(parseQRPayload(xss)).toBe(null);
  });

  it('coerces object-valued fields to strings (blocks object injection)', () => {
    // A malicious QR might pass objects instead of strings for address fields.
    // String() coercion ensures the result is always a plain string.
    const raw = JSON.stringify({
      type: 'merchant',
      programId: { toString: () => '0xmalicious' },
      merchantAddress: '0xdef456',
    });
    const result = parseQRPayload(raw);
    // JSON.stringify drops function-valued properties, so programId becomes {}
    // which is truthy but String({}) is '[object Object]' — not a valid address,
    // but importantly it is a string, not an object. The function must not throw.
    expect(result).toEqual({
      type: 'merchant',
      programId: '[object Object]',
      merchantAddress: '0xdef456',
    });
  });

  it('returns null for null JSON value', () => {
    expect(parseQRPayload('null')).toBe(null);
  });
});
