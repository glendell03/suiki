/**
 * QR code payload parsing utilities for Suiki.
 *
 * Merchant QR codes encode a MerchantQRPayload (type: 'merchant').
 * Customer QR codes encode a CustomerQRPayload (type: 'customer').
 *
 * Both payload shapes are defined in src/types/sui.ts as the QRPayload union.
 */

import type { MerchantQRPayload, CustomerQRPayload, QRPayload, SuiObjectId, SuiAddress } from '@/types/sui';

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
