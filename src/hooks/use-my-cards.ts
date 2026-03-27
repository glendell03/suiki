'use client';

import { useQuery } from '@tanstack/react-query';
import { getCardsByCustomer } from '@/lib/queries';
import { useAccount } from '@/hooks/use-account';
import { MOCK_CARDS, MOCK_WALLET_ADDRESS } from '@/lib/mock-data';
import type { StampCard } from '@/types/sui';

const IS_MOCK = !!MOCK_WALLET_ADDRESS && process.env.NODE_ENV !== 'production';

/**
 * Returns all StampCards owned by the currently connected customer wallet.
 *
 * In dev mock mode (NEXT_PUBLIC_MOCK_WALLET set), returns static fixture data
 * with no network calls so every customer page renders with realistic content.
 */
export function useMyCards() {
  const account = useAccount();

  return useQuery<StampCard[], Error>({
    queryKey: ['cards', account?.address],
    queryFn: IS_MOCK ? () => Promise.resolve(MOCK_CARDS) : () => getCardsByCustomer(account!.address),
    enabled: !!account,
    ...(IS_MOCK ? { initialData: MOCK_CARDS } : {}),
  });
}
