'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@/hooks/use-account';
import { MOCK_CARDS, MOCK_WALLET_ADDRESS } from '@/lib/mock-data';
import type { CardWithProgram } from '@/types/db';

const IS_MOCK = !!MOCK_WALLET_ADDRESS && process.env.NODE_ENV !== 'production';

/**
 * Returns all stamp cards owned by the currently connected customer wallet.
 *
 * Fetches from the DB-backed `/api/customer/[wallet]/cards` route which
 * returns cards joined with program metadata. In dev mock mode
 * (NEXT_PUBLIC_MOCK_WALLET set), returns static fixture data with no
 * network calls so every customer page renders with realistic content.
 */
export function useMyCards() {
  const account = useAccount();

  return useQuery<CardWithProgram[], Error>({
    queryKey: ['cards', account?.address],
    queryFn: IS_MOCK
      ? () => Promise.resolve(MOCK_CARDS as unknown as CardWithProgram[])
      : async () => {
          const res = await fetch(`/api/customer/${account!.address}/cards`);
          if (!res.ok) throw new Error(`Failed to fetch cards: ${res.status}`);
          return res.json();
        },
    enabled: !!account,
    ...(IS_MOCK ? { initialData: MOCK_CARDS as unknown as CardWithProgram[] } : {}),
  });
}
