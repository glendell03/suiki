/**
 * Unit tests for the daily transaction rate-limit utilities.
 *
 * Rate-limit state is stored in localStorage using the key pattern:
 *   suiki_daily_tx_YYYY-MM-DD_<merchantAddress>
 *
 * localStorage is not available in the vitest Node environment so we stub it
 * with vi.stubGlobal before each test and restore it with vi.unstubAllGlobals
 * in afterEach.  Date is frozen with vi.useFakeTimers so key generation is
 * deterministic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDailyTxCount,
  incrementDailyTxCount,
  isAtDailyLimit,
  isNearDailyLimit,
} from '../rate-limit';

// ---------------------------------------------------------------------------
// localStorage stub factory
// A simple in-memory Map that mirrors the real localStorage API.
// ---------------------------------------------------------------------------

function makeLocalStorageStub(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MERCHANT = '0xmerchant_test_address';

/** Freeze Date to a fixed local timestamp so key generation is deterministic. */
function freezeDate(isoDate = '2026-03-25T10:00:00'): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(isoDate));
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let localStorageStub: Storage;

beforeEach(() => {
  // Freeze time to 2026-03-25 so today's key is always suiki_daily_tx_2026-03-25_<addr>
  freezeDate('2026-03-25T10:00:00');

  localStorageStub = makeLocalStorageStub();
  vi.stubGlobal('localStorage', localStorageStub);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// getDailyTxCount
// ---------------------------------------------------------------------------

describe('getDailyTxCount', () => {
  it('returns 0 when no key exists for the merchant today', () => {
    expect(getDailyTxCount(MERCHANT)).toBe(0);
  });

  it('returns the stored count when a valid key exists', () => {
    localStorageStub.setItem(`suiki_daily_tx_2026-03-25_${MERCHANT}`, '7');
    expect(getDailyTxCount(MERCHANT)).toBe(7);
  });

  it('returns 0 when the stored value is NaN (corrupt data)', () => {
    localStorageStub.setItem(`suiki_daily_tx_2026-03-25_${MERCHANT}`, 'corrupt');
    expect(getDailyTxCount(MERCHANT)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// incrementDailyTxCount
// ---------------------------------------------------------------------------

describe('incrementDailyTxCount', () => {
  it('sets count to 1 on first increment (key did not exist)', () => {
    incrementDailyTxCount(MERCHANT);
    expect(getDailyTxCount(MERCHANT)).toBe(1);
  });

  it('increments an existing count by 1', () => {
    localStorageStub.setItem(`suiki_daily_tx_2026-03-25_${MERCHANT}`, '5');
    incrementDailyTxCount(MERCHANT);
    expect(getDailyTxCount(MERCHANT)).toBe(6);
  });

  it('increments correctly across multiple calls', () => {
    for (let i = 0; i < 3; i++) incrementDailyTxCount(MERCHANT);
    expect(getDailyTxCount(MERCHANT)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// isAtDailyLimit
// ---------------------------------------------------------------------------

describe('isAtDailyLimit', () => {
  it('returns false when count is 0', () => {
    expect(isAtDailyLimit(MERCHANT)).toBe(false);
  });

  it('returns false when count is 49', () => {
    localStorageStub.setItem(`suiki_daily_tx_2026-03-25_${MERCHANT}`, '49');
    expect(isAtDailyLimit(MERCHANT)).toBe(false);
  });

  it('returns true when count is exactly 50', () => {
    localStorageStub.setItem(`suiki_daily_tx_2026-03-25_${MERCHANT}`, '50');
    expect(isAtDailyLimit(MERCHANT)).toBe(true);
  });

  it('returns true when count exceeds 50', () => {
    localStorageStub.setItem(`suiki_daily_tx_2026-03-25_${MERCHANT}`, '99');
    expect(isAtDailyLimit(MERCHANT)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isNearDailyLimit
// ---------------------------------------------------------------------------

describe('isNearDailyLimit', () => {
  it('returns false when count is 0', () => {
    expect(isNearDailyLimit(MERCHANT)).toBe(false);
  });

  it('returns false when count is 39', () => {
    localStorageStub.setItem(`suiki_daily_tx_2026-03-25_${MERCHANT}`, '39');
    expect(isNearDailyLimit(MERCHANT)).toBe(false);
  });

  it('returns true when count is exactly 40', () => {
    localStorageStub.setItem(`suiki_daily_tx_2026-03-25_${MERCHANT}`, '40');
    expect(isNearDailyLimit(MERCHANT)).toBe(true);
  });

  it('returns true when count is between 40 and 49 (warning zone)', () => {
    localStorageStub.setItem(`suiki_daily_tx_2026-03-25_${MERCHANT}`, '45');
    expect(isNearDailyLimit(MERCHANT)).toBe(true);
  });

  it('returns true when count is at the hard limit (50)', () => {
    localStorageStub.setItem(`suiki_daily_tx_2026-03-25_${MERCHANT}`, '50');
    expect(isNearDailyLimit(MERCHANT)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Date rollover — keys from a previous day must not count
// ---------------------------------------------------------------------------

describe('date rollover', () => {
  it('does not count transactions from a previous day', () => {
    // Simulate transactions recorded yesterday under the 2026-03-24 key.
    // The function under test builds a key for the current date (2026-03-25)
    // so yesterday's key is simply not read — count must be 0.
    localStorageStub.setItem(`suiki_daily_tx_2026-03-24_${MERCHANT}`, '30');

    // Clock is frozen to 2026-03-25 in beforeEach so today's key is different.
    expect(getDailyTxCount(MERCHANT)).toBe(0);
  });

  it('does not treat yesterday count toward the daily limit', () => {
    localStorageStub.setItem(`suiki_daily_tx_2026-03-24_${MERCHANT}`, '50');
    // Even though yesterday hit the limit, today starts fresh.
    expect(isAtDailyLimit(MERCHANT)).toBe(false);
  });

  it('does not treat yesterday count as near the daily limit', () => {
    localStorageStub.setItem(`suiki_daily_tx_2026-03-24_${MERCHANT}`, '45');
    expect(isNearDailyLimit(MERCHANT)).toBe(false);
  });
});
