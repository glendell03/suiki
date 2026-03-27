'use client';

import { useQuery } from '@tanstack/react-query';
import { getProgramById } from '@/lib/queries';
import { MOCK_PROGRAMS, MOCK_WALLET_ADDRESS } from '@/lib/mock-data';
import type { StampProgram } from '@/types/sui';

const IS_MOCK = !!MOCK_WALLET_ADDRESS && process.env.NODE_ENV !== 'production';

/**
 * Fetches a single StampProgram by object ID.
 *
 * In dev mock mode (NEXT_PUBLIC_MOCK_WALLET set), resolves from static
 * fixture data so the merchant program detail page renders without a
 * real blockchain connection.
 */
export function useProgram(programId: string) {
  return useQuery<StampProgram | null, Error>({
    queryKey: ['program', programId],
    queryFn: IS_MOCK
      ? () => Promise.resolve(MOCK_PROGRAMS.find((p) => p.objectId === programId) ?? MOCK_PROGRAMS[0])
      : () => getProgramById(programId),
    enabled: !!programId,
    ...(IS_MOCK ? { initialData: MOCK_PROGRAMS.find((p) => p.objectId === programId) ?? MOCK_PROGRAMS[0] } : {}),
  });
}
