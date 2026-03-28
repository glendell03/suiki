'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';

/**
 * Returns the connected wallet account, or null if no wallet is connected.
 */
export function useAccount() {
  return useCurrentAccount();
}
