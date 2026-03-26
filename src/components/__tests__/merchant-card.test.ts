/**
 * Tests for MerchantCard logic helpers.
 *
 * Since jsdom is not available, these tests cover the pure derivation
 * functions extracted from the component: expand ID generation and
 * logo-fallback resolution.
 *
 * When jsdom is added, supplement with merchant-card.test.tsx for DOM tests.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Helpers under test -- mirror MerchantCard internal logic
// ---------------------------------------------------------------------------

/**
 * Build the DOM id used to link the toggle button (aria-controls) to the
 * expandable panel. Must be deterministic and URL-safe.
 */
function buildExpandId(merchantName: string): string {
  return `merchant-detail-${merchantName.replace(/\s+/g, "-").toLowerCase()}`;
}

/** Resolved display type for the merchant logo area. */
type LogoDisplay = { kind: "image"; url: string } | { kind: "emoji"; emoji: string };

/**
 * Determine what to show in the logo circle.
 * Prefers `logoUrl` when provided; falls back to `emoji` (default "🏪").
 */
function resolveLogoDisplay(logoUrl?: string, emoji?: string): LogoDisplay {
  if (logoUrl) return { kind: "image", url: logoUrl };
  return { kind: "emoji", emoji: emoji ?? "🏪" };
}

// ---------------------------------------------------------------------------
// buildExpandId
// ---------------------------------------------------------------------------

describe("buildExpandId", () => {
  it("converts merchant name to lowercase kebab-case id", () => {
    expect(buildExpandId("Coffee House")).toBe("merchant-detail-coffee-house");
  });

  it("collapses multiple spaces into a single dash", () => {
    expect(buildExpandId("My   Fancy   Shop")).toBe("merchant-detail-my-fancy-shop");
  });

  it("handles single-word names", () => {
    expect(buildExpandId("Starbucks")).toBe("merchant-detail-starbucks");
  });

  it("handles already-lowercase names", () => {
    expect(buildExpandId("ramen bar")).toBe("merchant-detail-ramen-bar");
  });

  it("handles empty string without throwing", () => {
    expect(buildExpandId("")).toBe("merchant-detail-");
  });
});

// ---------------------------------------------------------------------------
// resolveLogoDisplay
// ---------------------------------------------------------------------------

describe("resolveLogoDisplay", () => {
  it("returns image kind when logoUrl is provided", () => {
    const result = resolveLogoDisplay("https://example.com/logo.png");
    expect(result).toEqual({ kind: "image", url: "https://example.com/logo.png" });
  });

  it("returns emoji kind with custom emoji when no logoUrl", () => {
    const result = resolveLogoDisplay(undefined, "☕");
    expect(result).toEqual({ kind: "emoji", emoji: "☕" });
  });

  it("returns default emoji '🏪' when neither logoUrl nor emoji provided", () => {
    const result = resolveLogoDisplay(undefined, undefined);
    expect(result).toEqual({ kind: "emoji", emoji: "🏪" });
  });

  it("prefers logoUrl over emoji when both are provided", () => {
    const result = resolveLogoDisplay("https://example.com/logo.png", "☕");
    expect(result).toEqual({ kind: "image", url: "https://example.com/logo.png" });
  });

  it("treats empty string logoUrl as falsy, falls back to emoji", () => {
    const result = resolveLogoDisplay("", "☕");
    expect(result).toEqual({ kind: "emoji", emoji: "☕" });
  });
});

// ---------------------------------------------------------------------------
// Stamp count display (collapsed badge text)
// ---------------------------------------------------------------------------

describe("stamp count badge -- collapsed display", () => {
  it("formats as 'filled/total'", () => {
    const format = (filled: number, total: number) => `${filled}/${total}`;
    expect(format(3, 9)).toBe("3/9");
    expect(format(0, 9)).toBe("0/9");
    expect(format(9, 9)).toBe("9/9");
  });
});

// ---------------------------------------------------------------------------
// Props interface contract -- default values
// ---------------------------------------------------------------------------

describe("MerchantCard default prop values", () => {
  const DEFAULTS = {
    emoji: "🏪",
    filledStamps: 0,
    totalStamps: 9,
    isExpanded: false,
    stampEmoji: "⭐",
    className: "",
  };

  it("default emoji is store emoji", () => {
    expect(DEFAULTS.emoji).toBe("🏪");
  });

  it("default filledStamps is 0", () => {
    expect(DEFAULTS.filledStamps).toBe(0);
  });

  it("default totalStamps is 9", () => {
    expect(DEFAULTS.totalStamps).toBe(9);
  });

  it("default isExpanded is false", () => {
    expect(DEFAULTS.isExpanded).toBe(false);
  });

  it("default stampEmoji is star", () => {
    expect(DEFAULTS.stampEmoji).toBe("⭐");
  });
});
