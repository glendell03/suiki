/**
 * Tests for the stamp progress bar percentage calculation.
 *
 * The ProgressBarStamps component (planned) will render a horizontal progress
 * bar showing how close a customer is to earning their next reward.
 *
 * The pure helper `calculateStampPercentage` is tested here independently
 * of any rendering. When jsdom is available, add progress-bar-stamps.test.tsx
 * for visual regression and accessibility tests.
 *
 * Component target: src/components/progress-bar-stamps.tsx (planned)
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Helper under test
//
// `calculateStampPercentage` maps (filled, total) → a percentage clamped to
// [0, 100]. The production component must export an identically-behaving
// function (or inline the same logic).
// ---------------------------------------------------------------------------

/**
 * Compute the progress bar fill percentage for a stamp card.
 *
 * @param filled - Number of stamps the customer currently holds.
 * @param total  - Total stamps required to earn a reward.
 * @returns A number in [0, 100] representing the percentage, rounded to two
 *          decimal places. Returns 0 when total is 0 to avoid division by zero.
 */
function calculateStampPercentage(filled: number, total: number): number {
  if (total <= 0) return 0;
  const raw = (filled / total) * 100;
  // Clamp to [0, 100] and round to two decimal places.
  const clamped = Math.min(Math.max(raw, 0), 100);
  return Math.round(clamped * 100) / 100;
}

// ---------------------------------------------------------------------------
// Standard cases specified in the task
// ---------------------------------------------------------------------------

describe('calculateStampPercentage — standard cases', () => {
  it('returns 33.33 for filled=3, total=9', () => {
    expect(calculateStampPercentage(3, 9)).toBe(33.33);
  });

  it('returns 0 for filled=0, total=9', () => {
    expect(calculateStampPercentage(0, 9)).toBe(0);
  });

  it('returns 100 for filled=9, total=9 (card complete)', () => {
    expect(calculateStampPercentage(9, 9)).toBe(100);
  });

  it('clamps to 100 when filled > total', () => {
    // The caller might pass over-collected stamps; the bar must not exceed 100%.
    expect(calculateStampPercentage(12, 9)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('calculateStampPercentage — edge cases', () => {
  it('returns 0 when total is 0 (avoids division by zero)', () => {
    expect(calculateStampPercentage(0, 0)).toBe(0);
    expect(calculateStampPercentage(5, 0)).toBe(0);
  });

  it('returns 0 when filled is negative (invalid but safe)', () => {
    // Negative filled values should clamp to 0% rather than producing negative
    // percentages that could break CSS width calculations.
    expect(calculateStampPercentage(-1, 9)).toBe(0);
  });

  it('returns 50 for filled=5, total=10 (exact half)', () => {
    expect(calculateStampPercentage(5, 10)).toBe(50);
  });

  it('returns 10 for filled=1, total=10', () => {
    expect(calculateStampPercentage(1, 10)).toBe(10);
  });

  it('returns 100 for filled=10, total=10', () => {
    expect(calculateStampPercentage(10, 10)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Precision and rounding
// ---------------------------------------------------------------------------

describe('calculateStampPercentage — precision', () => {
  it('rounds to two decimal places (no floating-point drift in the UI)', () => {
    // 1/3 = 33.333… — must be rounded to 33.33, not 33.333333333333
    const result = calculateStampPercentage(1, 3);
    expect(result).toBe(33.33);
  });

  it('returns 66.67 for filled=2, total=3', () => {
    expect(calculateStampPercentage(2, 3)).toBe(66.67);
  });

  it('returns a finite number for any sane input', () => {
    // Guards against NaN slipping into CSS width properties.
    const result = calculateStampPercentage(7, 9);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('always returns a number in [0, 100]', () => {
    const cases: [number, number][] = [
      [0, 9],
      [3, 9],
      [9, 9],
      [15, 9],
      [-5, 9],
    ];
    for (const [filled, total] of cases) {
      const pct = calculateStampPercentage(filled, total);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// CSS width string generation
//
// Components often convert the percentage to a CSS string like "33.33%".
// Test the expected string format so the component and any template string
// consumers agree.
// ---------------------------------------------------------------------------

/**
 * Convert a stamp percentage to a CSS width value string.
 * Expected format: "33.33%" — used directly in style={{ width: ... }}.
 */
function stampPercentageToCss(filled: number, total: number): string {
  return `${calculateStampPercentage(filled, total)}%`;
}

describe('stampPercentageToCss — CSS string formatting', () => {
  it('produces "0%" for an empty card', () => {
    expect(stampPercentageToCss(0, 9)).toBe('0%');
  });

  it('produces "33.33%" for filled=3, total=9', () => {
    expect(stampPercentageToCss(3, 9)).toBe('33.33%');
  });

  it('produces "100%" for a complete card', () => {
    expect(stampPercentageToCss(9, 9)).toBe('100%');
  });

  it('produces "100%" when filled exceeds total', () => {
    expect(stampPercentageToCss(20, 9)).toBe('100%');
  });
});
