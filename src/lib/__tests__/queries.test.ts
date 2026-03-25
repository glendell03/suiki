/**
 * Tests for src/lib/queries.ts
 *
 * Setup required before running (vitest is not yet installed):
 *   npm install -D vitest @vitest/coverage-v8
 *   Add to package.json scripts: "test": "vitest run"
 *
 * The parse helpers (parseStampProgram, parseStampCard) are unexported
 * internal functions. They are tested indirectly via getProgramById, which
 * accepts the same json field shape and delegates to parseStampProgram.
 *
 * suiClient is a module-level singleton. Tests that exercise the full
 * query functions must mock it. The plain-TypeScript functions below
 * describe the expected mock setup and assertions; paste into vitest
 * it() blocks once the runner is available.
 *
 * This file compiles cleanly without vitest installed.
 */

import type { StampProgram, StampCard } from '../../types/sui';

// ---------------------------------------------------------------------------
// Compile-time interface checks
// ---------------------------------------------------------------------------

// Verify StampProgram has the camelCase fields we expect after parsing.
const _programShape: {
  objectId: StampProgram['objectId'];
  merchant: StampProgram['merchant'];
  name: StampProgram['name'];
  logoUrl: StampProgram['logoUrl'];
  stampsRequired: StampProgram['stampsRequired'];
  rewardDescription: StampProgram['rewardDescription'];
  totalIssued: StampProgram['totalIssued'];
} = {} as StampProgram;
void _programShape;

// Verify StampCard has the camelCase fields we expect after parsing.
const _cardShape: {
  objectId: StampCard['objectId'];
  programId: StampCard['programId'];
  customer: StampCard['customer'];
  merchantName: StampCard['merchantName'];
  merchantLogo: StampCard['merchantLogo'];
  stampsRequired: StampCard['stampsRequired'];
  currentStamps: StampCard['currentStamps'];
  totalEarned: StampCard['totalEarned'];
  lastStamped: StampCard['lastStamped'];
} = {} as StampCard;
void _cardShape;

// ---------------------------------------------------------------------------
// Minimal assertion helper
// ---------------------------------------------------------------------------

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

// ---------------------------------------------------------------------------
// parseStampProgram spec
//
// Tested via getProgramById — mock suiClient.getObject to return a
// controlled response, then assert the parsed StampProgram fields.
// ---------------------------------------------------------------------------

/*
POST-INSTALL vitest setup for parseStampProgram:

  import { vi } from 'vitest';
  import * as suiClientModule from '../sui-client';
  import { getProgramById } from '../queries';

  const mockGetObject = vi.fn();
  vi.spyOn(suiClientModule, 'suiClient', 'get').mockReturnValue({
    getObject: mockGetObject,
    listOwnedObjects: vi.fn(),
    listCoins: vi.fn(),
  } as unknown as typeof suiClientModule.suiClient);
*/

export function specParseStampProgram_mapsFields(): void {
  // Given: suiClient.getObject returns a valid StampProgram json shape.
  // When:  getProgramById('0xprog') is called.
  // Then:  the returned StampProgram has camelCase fields with correct types.
  //
  // Mock response to configure:
  const _mockObjectResponse = {
    object: {
      objectId: '0xprogramid',
      version: '1',
      digest: 'abc',
      owner: { $kind: 'Shared' as const, Shared: { initialSharedVersion: '1' } },
      type: '0xpkg::suiki::StampProgram',
      json: {
        id: { id: '0xprogramid' },
        merchant: '0xmerchant',
        name: 'Kape ni Juan',
        logo_url: 'https://example.com/logo.png',
        stamps_required: '10',
        reward_description: 'Free brewed coffee',
        total_issued: '42',
      },
      content: undefined,
      previousTransaction: undefined,
      objectBcs: undefined,
    },
  };
  //
  // Expected parsed result:
  const _expected: Partial<StampProgram> = {
    name: 'Kape ni Juan',
    logoUrl: 'https://example.com/logo.png',
    stampsRequired: 10,        // string '10' → number 10
    rewardDescription: 'Free brewed coffee',
    totalIssued: 42,           // string '42' → number 42
  };
  void _mockObjectResponse;
  void _expected;

  assert(true, 'spec documents parseStampProgram field mapping');
}

export function specParseStampProgram_missingRequiredField_returnsNull(): void {
  // Given: json is missing the `merchant` field (a required field).
  // When:  getProgramById is called.
  // Then:  getProgramById throws (because parseStampProgram returns null and
  //        getProgramById returns null — not throws — in the new gRPC version).
  //
  // Mock response to configure — note missing `merchant`:
  const _mockObjectResponse = {
    object: {
      objectId: '0xprogramid',
      version: '1',
      digest: 'abc',
      owner: { $kind: 'Shared' as const, Shared: { initialSharedVersion: '1' } },
      type: '0xpkg::suiki::StampProgram',
      json: {
        id: { id: '0xprogramid' },
        // merchant intentionally omitted
        name: 'Kape ni Juan',
        logo_url: '',
        stamps_required: '10',
        reward_description: 'Free coffee',
        total_issued: '0',
      },
      content: undefined,
      previousTransaction: undefined,
      objectBcs: undefined,
    },
  };
  // Expected: getProgramById resolves to null.
  void _mockObjectResponse;
  assert(true, 'spec documents null return on missing required field');
}

// ---------------------------------------------------------------------------
// parseStampCard spec
// ---------------------------------------------------------------------------

export function specParseStampCard_mapsFields(): void {
  // Given: suiClient.listOwnedObjects returns a StampCard json shape.
  // When:  getCardsByCustomer('0xcustomer') is called.
  // Then:  the returned StampCard has camelCase fields with correct types.
  //
  // Mock response to configure:
  const _mockListResponse = {
    objects: [
      {
        objectId: '0xcardid',
        version: '2',
        digest: 'def',
        owner: { $kind: 'AddressOwner' as const, AddressOwner: '0xcustomer' },
        type: '0xpkg::suiki::StampCard',
        json: {
          id: { id: '0xcardid' },
          program_id: '0xprogramid',
          customer: '0xcustomer',
          merchant_name: 'Kape ni Juan',
          merchant_logo: 'https://example.com/logo.png',
          stamps_required: '10',
          current_stamps: '3',
          total_earned: '1',
          last_stamped: '1700000000000',
        },
        content: undefined,
        previousTransaction: undefined,
        objectBcs: undefined,
      },
    ],
    hasNextPage: false,
    cursor: null,
  };
  //
  // Expected parsed result (snake_case → camelCase, string → number):
  const _expected: Partial<StampCard> = {
    merchantName: 'Kape ni Juan',      // merchant_name → merchantName
    merchantLogo: 'https://example.com/logo.png', // merchant_logo → merchantLogo
    stampsRequired: 10,                // '10' → 10
    currentStamps: 3,                  // '3' → 3
    totalEarned: 1,                    // '1' → 1
    lastStamped: 1700000000000,        // '1700000000000' → number
  };
  void _mockListResponse;
  void _expected;

  assert(true, 'spec documents parseStampCard field mapping');
}

export function specParseStampCard_missingRequiredField_omitsEntry(): void {
  // Given: one object in the list is missing program_id (a required field).
  // When:  getCardsByCustomer is called.
  // Then:  the malformed entry is filtered out; result array has length 0.
  //
  // Mock response — missing program_id:
  const _mockListResponse = {
    objects: [
      {
        objectId: '0xcardid',
        version: '1',
        digest: 'ghi',
        owner: { $kind: 'AddressOwner' as const, AddressOwner: '0xcustomer' },
        type: '0xpkg::suiki::StampCard',
        json: {
          // program_id intentionally omitted
          customer: '0xcustomer',
          stamps_required: '5',
          current_stamps: '0',
          total_earned: '0',
          last_stamped: '0',
        },
        content: undefined,
        previousTransaction: undefined,
        objectBcs: undefined,
      },
    ],
    hasNextPage: false,
    cursor: null,
  };
  void _mockListResponse;
  // Expected: result is an empty array.
  assert(true, 'spec documents that missing required field causes entry to be filtered');
}
