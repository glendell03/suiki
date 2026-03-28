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
 * Subscribes to StampIssued Move events for a specific stamp card and triggers
 * a one-frame animation flag when a new stamp is confirmed on-chain.
 *
 * Primary path: Sui WebSocket subscription (instant, ~0ms lag after tx confirm).
 * Fallback path: 3-second TanStack Query polling (activates only if WS fails).
 *
 * Animation handoff:
 *   1. Event arrives → mark animationRequested, invalidate ['cards'] query.
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
  const [wsFailed, setWsFailed] = useState(false);

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
  // Primary path: WebSocket subscription
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!cardId) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function subscribe() {
      try {
        unsubscribe = await suiBrowserClient.subscribeEvent({
          // Filter by package; narrow to StampIssued + this cardId in the handler.
          filter: { Package: PACKAGE_ID },
          onMessage(event) {
            if (event.type !== EVENT_TYPES.stampIssued) return;

            const fields = event.parsedJson as StampIssuedFields;
            if (fields.card_id !== cardId) return;

            const newCount = Number(fields.new_count);
            if (newCount <= lastKnownStampsRef.current) return;

            // Mark animation as requested and kick off a cache invalidation.
            // The animation fires once currentStamps prop increases (see effect above).
            animationRequestedRef.current = true;
            void queryClient.invalidateQueries({
              queryKey: ['cards', walletAddress],
            });
          },
        });

        if (cancelled) unsubscribe?.();
      } catch {
        // WebSocket unavailable — fall through to polling.
        if (!cancelled) setWsFailed(true);
      }
    }

    void subscribe();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [cardId, queryClient, walletAddress]);

  // ---------------------------------------------------------------------------
  // Fallback path: polling (enabled only when WS fails)
  // ---------------------------------------------------------------------------

  const { data: polledStamps } = useQuery({
    queryKey: ['card-stamp-poll', cardId],
    queryFn: async () => {
      const obj = await suiBrowserClient.getObject({
        id: cardId!,
        options: { showContent: true },
      });
      if (obj.data?.content?.dataType !== 'moveObject') return null;
      const fields = obj.data.content.fields as Record<string, unknown>;
      return extractStampCount(fields);
    },
    refetchInterval: 3000,
    enabled: wsFailed && !!cardId,
  });

  // Mirror the WebSocket path: mark animation requested, invalidate the query.
  useEffect(() => {
    if (polledStamps == null) return;
    if (polledStamps <= lastKnownStampsRef.current) return;

    animationRequestedRef.current = true;
    void queryClient.invalidateQueries({ queryKey: ['cards', walletAddress] });
  }, [polledStamps, queryClient, walletAddress]);

  return { pendingAnimation };
}
