'use client';

/**
 * Merchant profile hook — stub pending MerchantProfile on-chain object.
 *
 * Returns null until the MerchantProfile Move object and its query helpers
 * are implemented. Theme unlock logic falls back to free themes only.
 */

import { useAccount } from '@/hooks/use-account';

export interface MerchantProfile {
  objectId: string;
  merchant: string;
  unlockedThemes: number;
}

export function useMerchantProfile() {
  const account = useAccount();
  return {
    data: null as MerchantProfile | null,
    isLoading: false,
    error: null,
    isSuccess: !!account,
  };
}

/**
 * Returns whether a specific theme ID is unlocked by the current merchant.
 * Free themes (0–5) are always unlocked. Premium themes require a profile bit.
 */
export function useIsThemeUnlocked(themeId: number): boolean {
  const { data: profile } = useMerchantProfile();
  if (themeId < 6) return true;
  if (!profile) return false;
  return Boolean((profile.unlockedThemes >> themeId) & 1);
}
