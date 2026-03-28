'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { suiBrowserClient } from '@/lib/sui-client-browser';
import { EVENT_TYPES, PACKAGE_ID } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StampIssuedFields {
  card_id: string;
  new_count: string;
}

// ---------------------------------------------------------------------------
// Pure helper — exported for unit tests
// ---------------------------------------------------------------------------

/**
 * Parses `current_stamps` from a Sui object's content fields.
 *
 * Sui encodes u64 values as strings in JSON, so we accept both number and string.
 * Returns null if the field is absent or unparseable.
 */
export function extractStampCount(fields: Record<string, unknown>): number | null {
  const val = fields['current_stamps'];
  if (val == null) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Polls for StampIssued Move events for a specific stamp card and triggers
 * a one-frame animation flag when a new stamp is confirmed on-chain.
 *
 * Uses queryEvents polling (3s interval) — the @mysten/sui v2 SDK does not
 * support WebSocket subscriptions; polling is the supported event detection path.
 *
 * Animation handoff:
 *   1. Poll detects new event for this card → mark animationRequested, invalidate ['cards'].
 *   2. currentStamps prop increases (refetch completed) → setPendingAnimation(true).
 *   3. One rAF later → setPendingAnimation(false). Framer Motion finishes independently.
 *
 * @param cardId - On-chain StampCard object ID. Hook is a no-op when undefined.
 * @param currentStamps - Latest known stamp count from the parent component.
 * @param walletAddress - Customer wallet address; used as query key for cache invalidation.
 */
export function useStampEvents(
  cardId: string | undefined,
  currentStamps: number,
  walletAddress: string | undefined,
): { pendingAnimation: boolean } {
  const [pendingAnimation, setPendingAnimation] = useState(false);

  // Tracks the stamp count we last animated — avoids spurious animations on mount.
  const lastKnownStampsRef = useRef(currentStamps);
  // True between event arrival and the refetch completing.
  const animationRequestedRef = useRef(false);

  const queryClient = useQueryClient();

  // Initialise lastKnownStampsRef to whatever count the card already has.
  // Only runs once on mount — existing stamps must never trigger an animation.
  useEffect(() => {
    lastKnownStampsRef.current = currentStamps;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the refetched card data arrives and stamp count has increased,
  // fire the animation for exactly one render cycle.
  useEffect(() => {
    if (!animationRequestedRef.current) return;
    if (currentStamps <= lastKnownStampsRef.current) return;

    lastKnownStampsRef.current = currentStamps;
    animationRequestedRef.current = false;
    setPendingAnimation(true);
  }, [currentStamps]);

  // Reset the animation flag after one rAF — Framer Motion completes independently.
  useEffect(() => {
    if (!pendingAnimation) return;
    const id = requestAnimationFrame(() => setPendingAnimation(false));
    return () => cancelAnimationFrame(id);
  }, [pendingAnimation]);

  // ---------------------------------------------------------------------------
  // Event polling — queryEvents every 3 seconds
  // ---------------------------------------------------------------------------

  const { data: latestEventCount } = useQuery({
    queryKey: ['card-stamp-poll', cardId],
    queryFn: async () => {
      const result = await suiBrowserClient.queryEvents({
        query: { MoveEventType: EVENT_TYPES.stampIssued },
        limit: 50,
        order: 'descending',
      });

      for (const event of result.data) {
        const fields = event.parsedJson as StampIssuedFields | undefined;
        if (!fields || fields.card_id !== cardId) continue;
        const count = Number(fields.new_count);
        if (!isNaN(count)) return count;
      }
      return null;
    },
    refetchInterval: 3000,
    enabled: !!cardId,
  });

  // When polling detects a higher stamp count, request animation + invalidate cache.
  useEffect(() => {
    if (latestEventCount == null) return;
    if (latestEventCount <= lastKnownStampsRef.current) return;

    animationRequestedRef.current = true;
    void queryClient.invalidateQueries({ queryKey: ['cards', walletAddress] });
  }, [latestEventCount, queryClient, walletAddress]);

  return { pendingAnimation };
}
