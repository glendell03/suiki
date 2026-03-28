'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@/hooks/use-account';
import type { CardWithProgram } from '@/types/db';

/**
 * Returns all stamp cards owned by the currently connected customer wallet.
 * Fetches from the DB-backed `/api/customer/[wallet]/cards` route.
 */
export function useMyCards() {
  const account = useAccount();

  return useQuery<CardWithProgram[], Error>({
    queryKey: ['cards', account?.address],
    queryFn: async () => {
      const res = await fetch(`/api/customer/${account!.address}/cards`);
      if (!res.ok) throw new Error(`Failed to fetch cards: ${res.status}`);
      return res.json();
    },
    enabled: !!account,
  });
}
