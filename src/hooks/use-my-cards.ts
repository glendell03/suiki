'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';
import { getCardsByCustomer } from '@/lib/queries';
import type { StampCard } from '@/types/sui';

/**
 * Returns all StampCards owned by the currently connected customer wallet.
 *
 * The query is disabled when no wallet is connected (account === null) to
 * prevent spurious fetches and empty-state flicker on page load.
 */
export function useMyCards() {
  const account = useCurrentAccount();

  return useQuery<StampCard[], Error>({
    queryKey: ['cards', account?.address],
    queryFn: () => getCardsByCustomer(account!.address),
    enabled: !!account,
  });
}
