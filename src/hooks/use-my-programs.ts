'use client';

import { useQuery } from '@tanstack/react-query';
import { getProgramsByMerchant } from '@/lib/queries';
import { useAccount } from '@/hooks/use-account';
import { MOCK_PROGRAMS, MOCK_WALLET_ADDRESS } from '@/lib/mock-data';
import type { StampProgram } from '@/types/sui';

const IS_MOCK = !!MOCK_WALLET_ADDRESS && process.env.NODE_ENV !== 'production';

/**
 * Returns all StampPrograms created by the currently connected merchant wallet.
 *
 * In dev mock mode (NEXT_PUBLIC_MOCK_WALLET set), returns static fixture data
 * with no network calls so the merchant dashboard renders with realistic content.
 */
export function useMyPrograms() {
  const account = useAccount();

  return useQuery<StampProgram[], Error>({
    queryKey: ['programs', account?.address],
    queryFn: IS_MOCK ? () => Promise.resolve(MOCK_PROGRAMS) : () => getProgramsByMerchant(account!.address),
    enabled: !!account,
    ...(IS_MOCK ? { initialData: MOCK_PROGRAMS } : {}),
  });
}
