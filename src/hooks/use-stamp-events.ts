'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { suiBrowserClient } from '@/lib/sui-client-browser';
import { EVENT_TYPES, PACKAGE_ID } from '@/lib/constants';
import type { CardWithProgram } from '@/types/db';

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

  // Keep the animation flag alive long enough for the spring + ripple to complete.
  // The stamp spring (stiffness 380, damping 14) settles in ~400ms; the ripple
  // expand is 500ms. 650ms gives both time to finish before the flag clears.
  useEffect(() => {
    if (!pendingAnimation) return;
    const id = setTimeout(() => setPendingAnimation(false), 650);
    return () => clearTimeout(id);
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

  // When polling detects a higher stamp count:
  //   1. Optimistically patch the cache so the animation fires immediately.
  //   2. Trigger /api/indexer/sync so the DB is updated now (not at cron time).
  //   3. Invalidate the query so the refetch picks up the real DB value.
  useEffect(() => {
    if (latestEventCount == null) return;
    if (latestEventCount <= lastKnownStampsRef.current) return;

    animationRequestedRef.current = true;

    // Immediate visual update — no DB round-trip required for the animation.
    queryClient.setQueryData<CardWithProgram[]>(['cards', walletAddress], (prev) => {
      if (!prev || !cardId) return prev;
      return prev.map((c) =>
        c.cardId === cardId ? { ...c, currentStamps: latestEventCount } : c,
      );
    });

    // Push the event into Postgres right now, then refetch from the real DB.
    void fetch('/api/indexer/sync', { method: 'POST' }).then(() =>
      queryClient.invalidateQueries({ queryKey: ['cards', walletAddress] }),
    );
  }, [latestEventCount, queryClient, walletAddress, cardId]);

  return { pendingAnimation };
}
