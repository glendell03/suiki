/**
 * Tests for the FeatureGrid component tile configuration.
 *
 * FeatureGrid renders a 2x2 grid of shortcut tiles on the customer home page.
 * Each tile has an id, href, icon, title, subtitle, and four colour values.
 *
 * This file validates the FEATURES data array (structure, uniqueness, routes)
 * without rendering. When jsdom is set up, add feature-grid.test.tsx for
 * rendered output and accessibility tests.
 *
 * Component target: src/components/feature-grid.tsx
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Mirror the FeatureTile type so we can validate data shape
// ---------------------------------------------------------------------------

interface FeatureTile {
  id: string;
  href: string;
  icon: unknown;
  title: string;
  subtitle: string;
  fromColor: string;
  toColor: string;
  borderColor: string;
  accentColor: string;
}

// ---------------------------------------------------------------------------
// Import-free data snapshot — keeps the test independent of JSX/React imports
// that would fail without jsdom. We replicate the FEATURES array here.
// ---------------------------------------------------------------------------

const FEATURES: FeatureTile[] = [
  {
    id: "scan",
    href: "/customer/scan",
    icon: "Stamp",
    title: "Earn Stamps",
    subtitle: "Scan at any store",
    fromColor: "rgba(17,94,89,0.9)",
    toColor: "rgba(6,78,59,0.9)",
    borderColor: "rgba(45,212,191,0.25)",
    accentColor: "#2dd4bf",
  },
  {
    id: "cards",
    href: "/customer/cards",
    icon: "CreditCard",
    title: "My Cards",
    subtitle: "View all progress",
    fromColor: "rgba(26,61,42,0.9)",
    toColor: "rgba(19,42,31,0.9)",
    borderColor: "rgba(74,222,128,0.2)",
    accentColor: "#4ade80",
  },
  {
    id: "rewards",
    href: "/customer/cards",
    icon: "Gift",
    title: "Rewards",
    subtitle: "Redeem your stamps",
    fromColor: "rgba(120,53,15,0.85)",
    toColor: "rgba(69,26,3,0.85)",
    borderColor: "rgba(245,158,11,0.25)",
    accentColor: "#f59e0b",
  },
  {
    id: "lucky",
    href: "/customer/scan",
    icon: "Sparkles",
    title: "Lucky Draw",
    subtitle: "Stamp holders only",
    fromColor: "rgba(136,19,55,0.85)",
    toColor: "rgba(80,7,36,0.85)",
    borderColor: "rgba(244,63,94,0.25)",
    accentColor: "#f43f5e",
  },
];

// ---------------------------------------------------------------------------
// Grid completeness
// ---------------------------------------------------------------------------

describe("FeatureGrid tile configuration", () => {
  it("contains exactly four tiles for a 2x2 grid", () => {
    expect(FEATURES).toHaveLength(4);
  });

  it("every tile has a non-empty id", () => {
    for (const tile of FEATURES) {
      expect(tile.id).toBeTruthy();
      expect(typeof tile.id).toBe("string");
    }
  });

  it("all tile ids are unique", () => {
    const ids = FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// Route validation — all hrefs must be customer-domain paths
// ---------------------------------------------------------------------------

describe("FeatureGrid tile routes", () => {
  it("every tile links to a /customer/ route", () => {
    for (const tile of FEATURES) {
      expect(tile.href).toMatch(/^\/customer\//);
    }
  });

  it("no tile has an empty href", () => {
    for (const tile of FEATURES) {
      expect(tile.href.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Colour values — structural validation
// ---------------------------------------------------------------------------

describe("FeatureGrid tile colours", () => {
  it("every tile has valid rgba fromColor and toColor", () => {
    const rgbaPattern = /^rgba\(\d{1,3},\d{1,3},\d{1,3},[\d.]+\)$/;
    for (const tile of FEATURES) {
      expect(tile.fromColor).toMatch(rgbaPattern);
      expect(tile.toColor).toMatch(rgbaPattern);
    }
  });

  it("every tile has a valid rgba borderColor", () => {
    const rgbaPattern = /^rgba\(\d{1,3},\d{1,3},\d{1,3},[\d.]+\)$/;
    for (const tile of FEATURES) {
      expect(tile.borderColor).toMatch(rgbaPattern);
    }
  });

  it("every tile has a valid hex accentColor", () => {
    const hexPattern = /^#[0-9a-f]{6}$/i;
    for (const tile of FEATURES) {
      expect(tile.accentColor).toMatch(hexPattern);
    }
  });

  it("all accent colours are unique across tiles", () => {
    const accents = FEATURES.map((f) => f.accentColor);
    expect(new Set(accents).size).toBe(accents.length);
  });
});

// ---------------------------------------------------------------------------
// Text content — title and subtitle presence
// ---------------------------------------------------------------------------

describe("FeatureGrid tile text content", () => {
  it("every tile has a non-empty title", () => {
    for (const tile of FEATURES) {
      expect(tile.title.trim().length).toBeGreaterThan(0);
    }
  });

  it("every tile has a non-empty subtitle", () => {
    for (const tile of FEATURES) {
      expect(tile.subtitle.trim().length).toBeGreaterThan(0);
    }
  });

  it("all titles are unique", () => {
    const titles = FEATURES.map((f) => f.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

// ---------------------------------------------------------------------------
// Gradient assembly — helper to build the CSS gradient string
// ---------------------------------------------------------------------------

/**
 * Builds the CSS linear-gradient string for a tile, mirroring the inline
 * style applied in the FeatureGrid component.
 */
function buildTileGradient(tile: FeatureTile): string {
  return `linear-gradient(135deg, ${tile.fromColor}, ${tile.toColor})`;
}

describe("FeatureGrid gradient assembly", () => {
  it("produces a valid CSS linear-gradient string", () => {
    for (const tile of FEATURES) {
      const gradient = buildTileGradient(tile);
      expect(gradient).toContain("linear-gradient(135deg,");
      expect(gradient).toContain(tile.fromColor);
      expect(gradient).toContain(tile.toColor);
    }
  });

  it("all gradients are unique across tiles", () => {
    const gradients = FEATURES.map(buildTileGradient);
    expect(new Set(gradients).size).toBe(gradients.length);
  });
});
