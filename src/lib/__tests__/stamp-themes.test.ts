import { describe, it, expect } from 'vitest';
import {
  STAMP_THEMES,
  FREE_THEME_COUNT,
  PREMIUM_THEME_PRICE_SUI,
  getTheme,
  isThemeFree,
  type StampTheme,
} from '../stamp-themes';

describe('stamp-themes registry', () => {
  it('exports 11 total themes (6 free + 5 premium)', () => {
    expect(STAMP_THEMES).toHaveLength(11);
    expect(FREE_THEME_COUNT).toBe(6);
  });

  it('each theme has sequential IDs starting from 0', () => {
    STAMP_THEMES.forEach((theme, index) => {
      expect(theme.id).toBe(index);
    });
  });

  it('first 6 themes are free, next 5 are premium', () => {
    STAMP_THEMES.forEach((theme) => {
      if (theme.id < FREE_THEME_COUNT) {
        expect(theme.isPremium, `theme ${theme.id} should be free`).toBe(false);
      } else {
        expect(theme.isPremium, `theme ${theme.id} should be premium`).toBe(true);
      }
    });
  });

  it('premium themes have priceSui set', () => {
    STAMP_THEMES.filter((t) => t.isPremium).forEach((theme) => {
      if (theme.isPremium) {
        expect(theme.priceSui).toBe(PREMIUM_THEME_PRICE_SUI);
      }
    });
  });

  it('each theme has all required fields populated', () => {
    const requiredStringKeys: (keyof StampTheme)[] = [
      'name',
      'description',
      'vibe',
      'bgColor',
      'inkColor',
      'fillColor',
      'textColor',
    ];

    STAMP_THEMES.forEach((theme) => {
      requiredStringKeys.forEach((key) => {
        expect(theme[key], `theme ${theme.id} missing ${key}`).toBeTruthy();
      });
    });
  });

  it('color values are valid hex strings', () => {
    const colorKeys: (keyof StampTheme)[] = [
      'bgColor',
      'inkColor',
      'fillColor',
      'textColor',
    ];

    STAMP_THEMES.forEach((theme) => {
      colorKeys.forEach((key) => {
        const value = theme[key] as string;
        expect(value, `theme ${theme.id}.${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });
  });

  it('PREMIUM_THEME_PRICE_SUI is 1', () => {
    expect(PREMIUM_THEME_PRICE_SUI).toBe(1);
  });
});

describe('getTheme()', () => {
  it('returns the correct theme for valid IDs', () => {
    expect(getTheme(0).name).toBe('Classic Passport');
    expect(getTheme(3).name).toBe('Modern Badge');
    expect(getTheme(5).name).toBe('Playful Bubble');
  });

  it('returns premium themes by ID', () => {
    expect(getTheme(6).name).toBe('Gold Foil');
    expect(getTheme(7).name).toBe('Neon Glow');
    expect(getTheme(10).name).toBe('Dark Mode');
  });

  it('falls back to theme 0 for out-of-range IDs', () => {
    expect(getTheme(11)).toEqual(STAMP_THEMES[0]);
    expect(getTheme(99)).toEqual(STAMP_THEMES[0]);
    expect(getTheme(-1)).toEqual(STAMP_THEMES[0]);
  });
});

describe('isThemeFree()', () => {
  it('returns true for free theme IDs (0-5)', () => {
    for (let i = 0; i < FREE_THEME_COUNT; i++) {
      expect(isThemeFree(i), `theme ${i} should be free`).toBe(true);
    }
  });

  it('returns false for premium theme IDs (6-10)', () => {
    for (let i = FREE_THEME_COUNT; i <= 10; i++) {
      expect(isThemeFree(i), `theme ${i} should not be free`).toBe(false);
    }
  });

  it('returns false for out-of-range IDs above free count', () => {
    expect(isThemeFree(99)).toBe(false);
  });
});
