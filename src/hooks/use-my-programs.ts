'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';
import { getProgramsByMerchant } from '@/lib/queries';
import type { StampProgram } from '@/types/sui';

/**
 * Returns all StampPrograms created by the currently connected merchant wallet.
 */
export function useMyPrograms() {
  const account = useCurrentAccount();

  return useQuery<StampProgram[], Error>({
    queryKey: ['programs', account?.address],
    queryFn: () => getProgramsByMerchant(account!.address),
    enabled: !!account,
  });
}
