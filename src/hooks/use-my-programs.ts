'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@/hooks/use-account';
import type { ProgramWithMetadata } from '@/types/db';

/**
 * Returns all loyalty programs created by the currently connected merchant wallet.
 * Fetches from the DB-backed `/api/merchant/programs` route.
 */
export function useMyPrograms() {
  const account = useAccount();

  return useQuery<ProgramWithMetadata[], Error>({
    queryKey: ['programs', account?.address],
    queryFn: async () => {
      const res = await fetch(`/api/merchant/programs?merchant=${account!.address}`);
      if (!res.ok) throw new Error(`Failed to fetch programs: ${res.status}`);
      return res.json();
    },
    enabled: !!account,
  });
}
