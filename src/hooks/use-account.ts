'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { MOCK_WALLET_ADDRESS } from '@/lib/mock-data';

const IS_MOCK = !!MOCK_WALLET_ADDRESS && process.env.NODE_ENV !== 'production';

const MOCK_ACCOUNT = IS_MOCK
  ? { address: MOCK_WALLET_ADDRESS, publicKey: null, chains: ['sui:testnet' as const] }
  : null;

/**
 * Returns the connected wallet account.
 *
 * In development, when NEXT_PUBLIC_MOCK_WALLET is set, returns a static mock
 * account so all pages render with realistic data without a real wallet.
 * In production this simply delegates to useCurrentAccount().
 */
export function useAccount() {
  const real = useCurrentAccount();
  return real ?? MOCK_ACCOUNT;
}
