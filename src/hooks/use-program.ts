'use client';

import { useQuery } from '@tanstack/react-query';
import { MOCK_PROGRAMS, MOCK_WALLET_ADDRESS } from '@/lib/mock-data';
import type { ProgramWithMetadata } from '@/types/db';

const IS_MOCK = !!MOCK_WALLET_ADDRESS && process.env.NODE_ENV !== 'production';

/**
 * Fetches a single loyalty program by its on-chain object ID.
 *
 * Fetches from the DB-backed `/api/programs/[programId]` route. In dev mock mode
 * (NEXT_PUBLIC_MOCK_WALLET set), resolves from static fixture data so the program
 * detail page renders without a real database connection.
 */
export function useProgram(programId: string) {
  return useQuery<ProgramWithMetadata | null, Error>({
    queryKey: ['program', programId],
    queryFn: IS_MOCK
      ? () =>
          Promise.resolve(
            (MOCK_PROGRAMS.find((p) => p.objectId === programId) as unknown as ProgramWithMetadata) ??
              (MOCK_PROGRAMS[0] as unknown as ProgramWithMetadata),
          )
      : async () => {
          const res = await fetch(`/api/programs/${programId}`);
          if (!res.ok) return null;
          return res.json();
        },
    enabled: !!programId,
    ...(IS_MOCK
      ? {
          initialData:
            (MOCK_PROGRAMS.find((p) => p.objectId === programId) as unknown as ProgramWithMetadata) ??
            (MOCK_PROGRAMS[0] as unknown as ProgramWithMetadata),
        }
      : {}),
  });
}
