/**
 * Component tests for <StampProgress />.
 *
 * TODO: These tests require @testing-library/react and jsdom.
 *
 * Install dependencies first:
 *   pnpm add -D @testing-library/react @testing-library/user-event jsdom @vitejs/plugin-react
 *
 * After installing, also update vitest.config.ts to use jsdom for this file:
 *   // vitest.config.ts
 *   import { defineConfig } from 'vitest/config'
 *   import react from '@vitejs/plugin-react'
 *   export default defineConfig({
 *     plugins: [react()],
 *     test: {
 *       environment: 'jsdom',
 *       // ... rest of config
 *     },
 *   })
 *
 * See docs/qa-dependencies-needed.md for the full setup guide.
 *
 * -----------------------------------------------------------------------
 * Acceptance criteria being tested:
 *  1. Renders filled and empty dots for required <= 10
 *  2. Shows only text ("X / Y stamps") when required > 10
 *  3. "X / Y stamps" text is always present
 *  4. current=0: all dots are empty
 *  5. current=required: all dots are filled
 * -----------------------------------------------------------------------
 */

// TODO: Uncomment the block below once @testing-library/react is installed.

/*
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StampProgress } from '../stamp-progress';

describe('StampProgress', () => {
  // ------------------------------------------------------------------
  // Text counter — always present regardless of mode
  // ------------------------------------------------------------------

  it('shows "X / Y stamps" text for dot mode (required <= 10)', () => {
    render(<StampProgress current={3} required={8} />);
    expect(screen.getByText('3 / 8 stamps')).toBeTruthy();
  });

  it('shows "X / Y stamps" text for text-only mode (required > 10)', () => {
    render(<StampProgress current={5} required={20} />);
    expect(screen.getByText('5 / 20 stamps')).toBeTruthy();
  });

  // ------------------------------------------------------------------
  // Dot mode (required <= 10)
  // ------------------------------------------------------------------

  it('renders the correct number of total dots for required <= 10', () => {
    render(<StampProgress current={2} required={5} />);
    // The component renders '●' for filled and '○' for empty
    const filledDots = screen.getAllByText('●');
    const emptyDots = screen.getAllByText('○');
    expect(filledDots.length + emptyDots.length).toBe(5);
  });

  it('renders correct filled and empty dots', () => {
    render(<StampProgress current={3} required={8} />);
    expect(screen.getAllByText('●')).toHaveLength(3);
    expect(screen.getAllByText('○')).toHaveLength(5);
  });

  it('renders exactly required=10 dots', () => {
    render(<StampProgress current={4} required={10} />);
    const filled = screen.getAllByText('●');
    const empty = screen.getAllByText('○');
    expect(filled.length + empty.length).toBe(10);
  });

  // ------------------------------------------------------------------
  // Edge case: current = 0 (all dots empty)
  // ------------------------------------------------------------------

  it('renders all empty dots when current is 0', () => {
    render(<StampProgress current={0} required={6} />);
    // No filled dots should exist
    expect(screen.queryAllByText('●')).toHaveLength(0);
    expect(screen.getAllByText('○')).toHaveLength(6);
  });

  // ------------------------------------------------------------------
  // Edge case: current = required (all dots filled, card complete)
  // ------------------------------------------------------------------

  it('renders all filled dots when current equals required', () => {
    render(<StampProgress current={8} required={8} />);
    expect(screen.getAllByText('●')).toHaveLength(8);
    expect(screen.queryAllByText('○')).toHaveLength(0);
  });

  // ------------------------------------------------------------------
  // Text-only mode (required > 10) — NO dots rendered
  // ------------------------------------------------------------------

  it('does not render dots when required > 10', () => {
    render(<StampProgress current={5} required={15} />);
    expect(screen.queryAllByText('●')).toHaveLength(0);
    expect(screen.queryAllByText('○')).toHaveLength(0);
  });

  it('still shows text counter when required > 10', () => {
    render(<StampProgress current={12} required={25} />);
    expect(screen.getByText('12 / 25 stamps')).toBeTruthy();
  });

  // ------------------------------------------------------------------
  // Accessibility
  // ------------------------------------------------------------------

  it('has an accessible aria-label on the container', () => {
    render(<StampProgress current={3} required={8} />);
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-label')).toBe('3 of 8 stamps collected');
  });
});
*/

// Placeholder export so TypeScript does not complain about an empty module.
export {};
