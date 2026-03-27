/**
 * Tests for the Badge component variant → CSS class mapping.
 *
 * Badge is a small inline label used throughout the UI to indicate loyalty
 * program status (e.g. "New", "Complete", "Reward Ready"). Each variant maps
 * to a specific Tailwind/CSS-variable class string.
 *
 * This file tests the pure mapping logic without rendering. When jsdom is
 * set up (see Docs/qa-dependencies-needed.md), add badge.test.tsx for
 * rendered output and accessibility tests.
 *
 * Component target: src/components/badge.tsx (planned)
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Types — mirrors the planned Badge component's prop interface
// ---------------------------------------------------------------------------

/**
 * Visual variants for the Badge component.
 *
 * - "success"  — positive state (reward redeemed, card complete)
 * - "loyalty"  — loyalty accent colour (stamps collected, progress)
 * - "info"     — neutral informational state
 * - "warning"  — attention required (near limit, expiring soon)
 */
type BadgeVariant = 'success' | 'loyalty' | 'info' | 'warning';

// ---------------------------------------------------------------------------
// Helper under test — mirrors the class lookup the Badge component will use
// ---------------------------------------------------------------------------

/**
 * Maps a badge variant to the corresponding Tailwind / CSS-variable class string.
 *
 * The class string is appended to the base badge classes inside the component.
 * Tests assert the presence of design-system tokens rather than exact strings
 * so minor class reordering does not break tests.
 */
const BADGE_VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-(--color-primary) text-(--color-bg-base)',
  loyalty: 'bg-(--color-accent-loyalty) text-(--color-bg-base)',
  info: 'bg-(--color-bg-elevated) text-(--color-text-secondary)',
  warning: 'bg-(--color-accent-warning) text-(--color-bg-base)',
};

/**
 * Return the CSS class string for a badge variant.
 * Replicates the lookup the Badge component performs internally.
 */
function getBadgeClasses(variant: BadgeVariant): string {
  return BADGE_VARIANT_CLASSES[variant];
}

// ---------------------------------------------------------------------------
// Variant → class mapping — each variant checked individually
// ---------------------------------------------------------------------------

describe('Badge variant class mapping', () => {
  describe('success variant', () => {
    it('contains the primary color token (green — reward/complete state)', () => {
      const classes = getBadgeClasses('success');
      expect(classes).toContain('color-primary');
    });

    it('includes a text color class for contrast on the primary background', () => {
      const classes = getBadgeClasses('success');
      expect(classes).toContain('text-');
    });

    it('is distinct from the loyalty variant', () => {
      expect(getBadgeClasses('success')).not.toBe(getBadgeClasses('loyalty'));
    });
  });

  describe('loyalty variant', () => {
    it('contains the loyalty accent color token (gold — stamp progress)', () => {
      const classes = getBadgeClasses('loyalty');
      expect(classes).toContain('accent-loyalty');
    });

    it('includes a text color class for contrast on the loyalty background', () => {
      const classes = getBadgeClasses('loyalty');
      expect(classes).toContain('text-');
    });
  });

  describe('info variant', () => {
    it('contains an elevated background color (neutral — informational)', () => {
      const classes = getBadgeClasses('info');
      expect(classes).toContain('color-bg-elevated');
    });

    it('uses a secondary text color for reduced visual weight', () => {
      const classes = getBadgeClasses('info');
      expect(classes).toContain('color-text-secondary');
    });
  });

  describe('warning variant', () => {
    it('contains the warning accent color token (attention state)', () => {
      const classes = getBadgeClasses('warning');
      expect(classes).toContain('accent-warning');
    });
  });
});

// ---------------------------------------------------------------------------
// Map completeness and uniqueness
// ---------------------------------------------------------------------------

describe('BADGE_VARIANT_CLASSES completeness', () => {
  it('has an entry for every BadgeVariant value', () => {
    const allVariants: BadgeVariant[] = ['success', 'loyalty', 'info', 'warning'];
    for (const variant of allVariants) {
      expect(BADGE_VARIANT_CLASSES[variant]).toBeDefined();
      expect(BADGE_VARIANT_CLASSES[variant].length).toBeGreaterThan(0);
    }
  });

  it('each variant maps to a unique class string (no two variants share the same appearance)', () => {
    const allValues = Object.values(BADGE_VARIANT_CLASSES);
    const uniqueValues = new Set(allValues);
    expect(uniqueValues.size).toBe(allValues.length);
  });

  it('contains exactly four variant entries', () => {
    expect(Object.keys(BADGE_VARIANT_CLASSES)).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Base class assembly — Badge appends variant classes to a shared base
// ---------------------------------------------------------------------------

/**
 * Base classes shared by all badge variants.
 * Replicates what the Badge component prepends before the variant classes.
 */
const BADGE_BASE_CLASSES =
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';

/**
 * Assemble the full class string for a badge (base + variant).
 * Mirrors what the Badge component's className prop will produce.
 */
function assembleBadgeClassName(variant: BadgeVariant, extra = ''): string {
  return [BADGE_BASE_CLASSES, BADGE_VARIANT_CLASSES[variant], extra]
    .filter(Boolean)
    .join(' ');
}

describe('Badge full className assembly', () => {
  it('includes the base classes for every variant', () => {
    const variants: BadgeVariant[] = ['success', 'loyalty', 'info', 'warning'];
    for (const variant of variants) {
      const result = assembleBadgeClassName(variant);
      expect(result).toContain('inline-flex');
      expect(result).toContain('rounded-full');
      expect(result).toContain('text-xs');
    }
  });

  it('appends extra className when provided', () => {
    const result = assembleBadgeClassName('success', 'ml-2');
    expect(result).toContain('ml-2');
  });

  it('does not produce double spaces in the assembled string', () => {
    const result = assembleBadgeClassName('loyalty', '');
    expect(result).not.toMatch(/  /);
  });
});
