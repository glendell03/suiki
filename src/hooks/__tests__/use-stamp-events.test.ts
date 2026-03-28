import { describe, it, expect, vi } from 'vitest';

// Mock browser-only dependencies so the pure helper can be imported in Node
vi.mock('@/lib/sui-client-browser', () => ({ suiBrowserClient: {} }));
vi.mock('@/lib/constants', () => ({
  PACKAGE_ID: '0xtest',
  EVENT_TYPES: { stampIssued: '0xtest::suiki::StampIssued' },
}));

import { extractStampCount } from '../use-stamp-events';

describe('extractStampCount', () => {
  it('parses a numeric current_stamps field', () => {
    expect(extractStampCount({ current_stamps: 3 })).toBe(3);
  });

  it('parses a string current_stamps field (Sui encodes u64 as string)', () => {
    expect(extractStampCount({ current_stamps: '5' })).toBe(5);
  });

  it('returns null when current_stamps is missing', () => {
    expect(extractStampCount({})).toBeNull();
  });

  it('returns null when current_stamps is not parseable as a number', () => {
    expect(extractStampCount({ current_stamps: 'not-a-number' })).toBeNull();
  });

  it('returns 0 for zero stamps', () => {
    expect(extractStampCount({ current_stamps: 0 })).toBe(0);
  });

  it('returns null when current_stamps is null', () => {
    expect(extractStampCount({ current_stamps: null })).toBeNull();
  });
});
