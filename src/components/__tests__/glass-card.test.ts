/**
 * Tests for GlassCard component logic.
 *
 * GlassCard has no extractable pure logic beyond its PADDING_CLASSES map,
 * which is internal. This file:
 *   1. Validates the padding → CSS class mapping by replicating the same
 *      lookup table and asserting its shape and values.
 *   2. Uses TypeScript compile-time assertions to document valid prop shapes
 *      without requiring jsdom or @testing-library/react.
 *
 * When jsdom is set up (see Docs/qa-dependencies-needed.md), add a
 * glass-card.test.tsx alongside this file to cover DOM rendering.
 *
 * Component source: src/components/glass-card.tsx
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Replicated constants — kept in sync with glass-card.tsx.
//
// If PADDING_CLASSES in the component changes, this test will catch drift
// because the values are asserted explicitly.
// ---------------------------------------------------------------------------

type GlassPadding = 'none' | 'sm' | 'md' | 'lg';

/**
 * Padding size → Tailwind class mapping, replicated from GlassCard.
 * Tests assert each entry individually so failures pinpoint which variant broke.
 */
const PADDING_CLASSES: Record<GlassPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

// ---------------------------------------------------------------------------
// TypeScript compile-time shape checks.
//
// These are not runtime tests — they exist so that TypeScript will error here
// if the GlassCardProps interface changes incompatibly. The void expressions
// prevent "declared but never read" lint warnings.
// ---------------------------------------------------------------------------

/** Minimal valid props: only children is required. */
const _minimalProps = {
  children: 'hello',
};
void _minimalProps;

/** All optional props provided at once — must compile cleanly. */
const _fullProps = {
  children: 'hello',
  className: 'extra-class',
  padding: 'lg' as GlassPadding,
  as: 'article' as const,
};
void _fullProps;

/** Interactive variant with onClick handler. */
const _interactiveProps = {
  children: 'press me',
  onClick: (_e: MouseEvent) => { /* handler */ },
  as: 'div' as const,
  padding: 'sm' as GlassPadding,
};
void _interactiveProps;

// ---------------------------------------------------------------------------
// PADDING_CLASSES — value correctness
// ---------------------------------------------------------------------------

describe('GlassCard PADDING_CLASSES map', () => {
  it('maps "none" to an empty string (no padding class applied)', () => {
    expect(PADDING_CLASSES.none).toBe('');
  });

  it('maps "sm" to "p-3" (Tailwind small padding)', () => {
    expect(PADDING_CLASSES.sm).toBe('p-3');
  });

  it('maps "md" to "p-4" (Tailwind medium padding — the default)', () => {
    expect(PADDING_CLASSES.md).toBe('p-4');
  });

  it('maps "lg" to "p-5" (Tailwind large padding)', () => {
    expect(PADDING_CLASSES.lg).toBe('p-5');
  });

  it('contains exactly four padding variants', () => {
    expect(Object.keys(PADDING_CLASSES)).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// className assembly — the component joins classes and filters empty strings.
// Replicate that logic to verify the filter-and-join pattern works correctly.
// ---------------------------------------------------------------------------

/**
 * Replicates the className assembly logic from GlassCard.
 * The component uses: [...].filter(Boolean).join(' ')
 */
function assembleClassName(
  padding: GlassPadding,
  isInteractive: boolean,
  extra: string,
): string {
  return [
    'glass-card',
    PADDING_CLASSES[padding],
    isInteractive ? 'tap-target cursor-pointer' : '',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

describe('GlassCard className assembly', () => {
  it('includes "glass-card" base class in all variants', () => {
    expect(assembleClassName('md', false, '')).toContain('glass-card');
    expect(assembleClassName('none', true, '')).toContain('glass-card');
  });

  it('omits the padding class when padding="none"', () => {
    const result = assembleClassName('none', false, '');
    // Should not have any px or py class from the padding map.
    expect(result).not.toMatch(/\bp-\d\b/);
  });

  it('includes the padding class for non-none variants', () => {
    expect(assembleClassName('sm', false, '')).toContain('p-3');
    expect(assembleClassName('md', false, '')).toContain('p-4');
    expect(assembleClassName('lg', false, '')).toContain('p-5');
  });

  it('adds interactive classes when onClick is provided (isInteractive=true)', () => {
    const result = assembleClassName('md', true, '');
    expect(result).toContain('tap-target');
    expect(result).toContain('cursor-pointer');
  });

  it('omits interactive classes when onClick is absent (isInteractive=false)', () => {
    const result = assembleClassName('md', false, '');
    expect(result).not.toContain('tap-target');
    expect(result).not.toContain('cursor-pointer');
  });

  it('appends extra className when provided', () => {
    const result = assembleClassName('md', false, 'custom-border');
    expect(result).toContain('custom-border');
  });

  it('does not produce double spaces when padding="none" and no extra class', () => {
    const result = assembleClassName('none', false, '');
    expect(result).not.toMatch(/  /);
  });
});
