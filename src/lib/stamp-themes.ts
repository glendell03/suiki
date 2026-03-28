/**
 * Stamp theme registry -- maps theme IDs to metadata.
 * IDs 0-5 are free built-in themes.
 * IDs 6-10 are premium themes (require purchase).
 *
 * FREE_THEME_COUNT must stay in sync with the Move contract.
 */

export const FREE_THEME_COUNT = 6;

/** Price of one premium theme in SUI (display only — contract uses MIST). */
export const PREMIUM_THEME_PRICE_SUI = 1;

export type StampTheme =
  | {
      id: number;
      name: string;
      description: string;
      vibe: string;
      bgColor: string;
      inkColor: string;
      fillColor: string;
      textColor: string;
      isPremium: false;
    }
  | {
      id: number;
      name: string;
      description: string;
      vibe: string;
      bgColor: string;
      inkColor: string;
      fillColor: string;
      textColor: string;
      isPremium: true;
      priceSui: number;
    };

export const STAMP_THEMES: StampTheme[] = [
  // ── Free themes ──────────────────────────────────────────────────────────
  {
    id: 0,
    name: 'Classic Passport',
    description: 'Double ring with radial ticks -- timeless collector feel',
    vibe: 'Collector · Heritage · Trust',
    bgColor: '#eef2f7',
    inkColor: '#1e3a5f',
    fillColor: '#1e3a5f',
    textColor: '#ffffff',
    isPremium: false,
  },
  {
    id: 1,
    name: 'Wax Seal',
    description: 'Scalloped seal edge -- premium, luxurious brand feel',
    vibe: 'Premium · Exclusive · Luxury',
    bgColor: '#f5f3ff',
    inkColor: '#7c3aed',
    fillColor: '#7c3aed',
    textColor: '#ffffff',
    isPremium: false,
  },
  {
    id: 2,
    name: 'Rough Ink',
    description: 'Imperfect rubber stamp -- authentic, artisan character',
    vibe: 'Artisan · Handcrafted · Warm',
    bgColor: '#fffbeb',
    inkColor: '#92400e',
    fillColor: '#b45309',
    textColor: '#ffffff',
    isPremium: false,
  },
  {
    id: 3,
    name: 'Modern Badge',
    description: 'Clean circle with cross motif -- minimal, contemporary',
    vibe: 'Minimal · Tech · Clean',
    bgColor: '#f0f9ff',
    inkColor: '#0369a1',
    fillColor: '#0ea5e9',
    textColor: '#ffffff',
    isPremium: false,
  },
  {
    id: 4,
    name: 'Postmark',
    description: 'Postal cancellation style -- nostalgic, graphic, fun',
    vibe: 'Nostalgic · Bold · Graphic',
    bgColor: '#fef2f2',
    inkColor: '#991b1b',
    fillColor: '#dc2626',
    textColor: '#ffffff',
    isPremium: false,
  },
  {
    id: 5,
    name: 'Playful Bubble',
    description: 'Dot-pattern circle -- friendly, approachable, joyful',
    vibe: 'Fun · Friendly · Approachable',
    bgColor: '#f0fdf4',
    inkColor: '#065f46',
    fillColor: '#10b981',
    textColor: '#ffffff',
    isPremium: false,
  },
  // ── Premium themes ────────────────────────────────────────────────────────
  {
    id: 6,
    name: 'Gold Foil',
    description: 'Metallic gold ring with fine cross-hatch -- luxurious and exclusive',
    vibe: 'Luxury · Prestige · Exclusive',
    bgColor: '#fefce8',
    inkColor: '#a16207',
    fillColor: '#ca8a04',
    textColor: '#ffffff',
    isPremium: true,
    priceSui: 1,
  },
  {
    id: 7,
    name: 'Neon Glow',
    description: 'Glowing neon circle with blur halo -- cyberpunk energy',
    vibe: 'Cyber · Electric · Bold',
    bgColor: '#0f0f1a',
    inkColor: '#a855f7',
    fillColor: '#7c3aed',
    textColor: '#e9d5ff',
    isPremium: true,
    priceSui: 1,
  },
  {
    id: 8,
    name: 'Cherry Blossom',
    description: 'Petal-bordered circle -- elegant, seasonal, Japanese-inspired',
    vibe: 'Elegant · Seasonal · Soft',
    bgColor: '#fff1f2',
    inkColor: '#be185d',
    fillColor: '#ec4899',
    textColor: '#ffffff',
    isPremium: true,
    priceSui: 1,
  },
  {
    id: 9,
    name: 'Ocean Wave',
    description: 'Concentric arc swirls -- fluid, calming, coastal',
    vibe: 'Fluid · Calm · Coastal',
    bgColor: '#eff6ff',
    inkColor: '#1d4ed8',
    fillColor: '#2563eb',
    textColor: '#ffffff',
    isPremium: true,
    priceSui: 1,
  },
  {
    id: 10,
    name: 'Dark Mode',
    description: 'Solid charcoal fill with silver ring -- sleek, minimal, dark',
    vibe: 'Sleek · Dark · Minimal',
    bgColor: '#0f172a',
    inkColor: '#94a3b8',
    fillColor: '#1e293b',
    textColor: '#f1f5f9',
    isPremium: true,
    priceSui: 1,
  },
];

/** Returns theme metadata by ID, falling back to theme 0. */
export function getTheme(themeId: number): StampTheme {
  return (STAMP_THEMES[themeId] ?? STAMP_THEMES[0]) as StampTheme;
}

/** Returns true if a theme ID is in the free range. */
export function isThemeFree(themeId: number): boolean {
  return themeId < FREE_THEME_COUNT;
}
