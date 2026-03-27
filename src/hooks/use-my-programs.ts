'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@/hooks/use-account';
import { MOCK_PROGRAMS, MOCK_WALLET_ADDRESS } from '@/lib/mock-data';
import type { ProgramWithMetadata } from '@/types/db';

const IS_MOCK = !!MOCK_WALLET_ADDRESS && process.env.NODE_ENV !== 'production';

/**
 * Returns all loyalty programs created by the currently connected merchant wallet.
 *
 * Fetches from the DB-backed `/api/merchant/programs` route. In dev mock mode
 * (NEXT_PUBLIC_MOCK_WALLET set), returns static fixture data with no network
 * calls so the merchant dashboard renders with realistic content.
 */
export function useMyPrograms() {
  const account = useAccount();

  return useQuery<ProgramWithMetadata[], Error>({
    queryKey: ['programs', account?.address],
    queryFn: IS_MOCK
      ? () => Promise.resolve(MOCK_PROGRAMS as unknown as ProgramWithMetadata[])
      : async () => {
          const res = await fetch(`/api/merchant/programs?merchant=${account!.address}`);
          if (!res.ok) throw new Error(`Failed to fetch programs: ${res.status}`);
          return res.json();
        },
    enabled: !!account,
    ...(IS_MOCK ? { initialData: MOCK_PROGRAMS as unknown as ProgramWithMetadata[] } : {}),
  });
}
