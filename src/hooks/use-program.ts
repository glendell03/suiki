'use client';

import { useQuery } from '@tanstack/react-query';
import type { ProgramWithMetadata } from '@/types/db';

/**
 * Fetches a single loyalty program by its on-chain object ID.
 * Fetches from the DB-backed `/api/programs/[programId]` route.
 */
export function useProgram(programId: string) {
  return useQuery<ProgramWithMetadata | null, Error>({
    queryKey: ['program', programId],
    queryFn: async () => {
      const res = await fetch(`/api/programs/${programId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!programId,
  });
}
