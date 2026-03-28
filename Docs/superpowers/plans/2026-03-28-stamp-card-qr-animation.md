# Stamp Card QR + Real-Time Stamp Animation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Apple Wallet–style QR code to the customer stamp card detail page, and play the stamp animation on the customer's screen in real time after a merchant scans it and the blockchain confirms.

**Architecture:** A new browser-side `SuiClient` subscribes to `StampIssued` Move events (WebSocket). When an event fires for this card, the `useStampEvents` hook invalidates the `useMyCards` query and sets a one-frame animation flag. When the refetch completes and `stampCount` increases, `StampCard` receives `animateNewStamp={true}` and `ThemedStampGrid` spring-animates the new slot. Polling via TanStack Query (`refetchInterval: 3000`) activates only when the WebSocket subscription fails.

**Tech Stack:** `@mysten/sui/client` (browser SuiClient), TanStack Query v5, Framer Motion, existing `BeautifulQR` + `encodeCustomerCardQR`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/sui-client-browser.ts` | **Create** | Browser-only `SuiClient` singleton for WebSocket event subscriptions |
| `src/hooks/use-stamp-events.ts` | **Create** | WebSocket subscription + polling fallback; returns `{ pendingAnimation }` |
| `src/hooks/__tests__/use-stamp-events.test.ts` | **Create** | Unit test for `extractStampCount` pure helper |
| `src/app/customer/cards/[cardId]/page.tsx` | **Modify** | Wire `useStampEvents`, pass `animateNewStamp`, add QR panel |

Files untouched: `qr-utils.ts`, `qr-scanner.tsx`, `stamp-slot.tsx`, `merchant/[programId]/page.tsx`, Move contract.

---

## Task 1 — Browser SuiClient singleton

**Files:**
- Create: `src/lib/sui-client-browser.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/sui-client-browser.ts
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { SUI_NETWORK } from '@/lib/constants';

/**
 * Browser-side SuiClient for client components and hooks.
 *
 * This is NOT the server-side gRPC singleton at src/lib/sui-client.ts.
 * Use this only in 'use client' files — never import in server components or API routes.
 *
 * Supports both HTTP queries and WebSocket subscriptions (subscribeEvent).
 * The SDK derives the WebSocket endpoint automatically from the HTTP URL.
 */
export const suiBrowserClient = new SuiClient({
  url: getFullnodeUrl(SUI_NETWORK),
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sui-client-browser.ts
git commit -m "feat(sui): add browser-side SuiClient singleton for WebSocket subscriptions"
```

---

## Task 2 — `useStampEvents` hook

**Files:**
- Create: `src/hooks/use-stamp-events.ts`
- Create: `src/hooks/__tests__/use-stamp-events.test.ts`

### Step 2.1 — Write the failing test first

- [ ] **Step 1: Create the test file**

```typescript
// src/hooks/__tests__/use-stamp-events.test.ts
import { describe, it, expect } from 'vitest';
import { extractStampCount } from '../use-stamp-events';

describe('extractStampCount', () => {
  it('parses a numeric current_stamps field', () => {
    expect(extractStampCount({ current_stamps: 3 })).toBe(3);
  });

  it('parses a string current_stamps field (Sui encodes u64 as string)', () => {
    expect(extractStampCount({ current_stamps: '5' })).toBe(5);
  });

  it('returns null when current_stamps is missing', () => {
    expect(extractStampCount({})).toBeNull();
  });

  it('returns null when current_stamps is not parseable as a number', () => {
    expect(extractStampCount({ current_stamps: 'not-a-number' })).toBeNull();
  });

  it('returns 0 for zero stamps', () => {
    expect(extractStampCount({ current_stamps: 0 })).toBe(0);
  });

  it('returns null when current_stamps is null', () => {
    expect(extractStampCount({ current_stamps: null })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL (module not found)**

```bash
pnpm vitest run src/hooks/__tests__/use-stamp-events.test.ts
```

Expected: `Error: Cannot find module '../use-stamp-events'`

### Step 2.2 — Implement the hook

- [ ] **Step 3: Create `src/hooks/use-stamp-events.ts`**

```typescript
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
```

- [ ] **Step 4: Run the test — expect PASS**

```bash
pnpm vitest run src/hooks/__tests__/use-stamp-events.test.ts
```

Expected output:
```
✓ src/hooks/__tests__/use-stamp-events.test.ts (6)
  ✓ extractStampCount > parses a numeric current_stamps field
  ✓ extractStampCount > parses a string current_stamps field (Sui encodes u64 as string)
  ✓ extractStampCount > returns null when current_stamps is missing
  ✓ extractStampCount > returns null when current_stamps is not parseable as a number
  ✓ extractStampCount > returns 0 for zero stamps
  ✓ extractStampCount > returns null when current_stamps is null

Test Files  1 passed (1)
```

- [ ] **Step 5: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-stamp-events.ts src/hooks/__tests__/use-stamp-events.test.ts
git commit -m "feat(hooks): add useStampEvents — Sui WS subscription + polling fallback"
```

---

## Task 3 — Card detail page: QR panel + animation wiring

**Files:**
- Modify: `src/app/customer/cards/[cardId]/page.tsx`

The current file structure to understand before editing:

```
CardDetailView({ cardId })
  useAccount()                           ← gives wallet address
  useMyCards()                           ← gives cards array
  const card = cards.find(c => c.cardId === cardId) ?? null
  ← ADD useStampEvents() HERE (before early returns) ←
  if (isLoading) return ...
  if (isError) return ...
  if (!card) return ...
  return (
    ...
    <StampCard ... />                    ← ADD animateNewStamp={pendingAnimation}
    {card.lastStampedAt && <div .../>}
    ← ADD QR panel HERE ←
  )
```

- [ ] **Step 1: Add imports**

At the top of `src/app/customer/cards/[cardId]/page.tsx`, add these imports alongside the existing ones:

```typescript
import { useStampEvents } from "@/hooks/use-stamp-events";
import { BeautifulQR } from "@/components/beautiful-qr";
import { encodeCustomerCardQR } from "@/lib/qr-utils";
```

- [ ] **Step 2: Wire `useStampEvents` in `CardDetailView`**

Find this block inside `CardDetailView` (after `const card = ...` and before `if (isLoading)`):

```typescript
  const card = cards?.find((c) => c.cardId === cardId) ?? null;

  // Loading state
  if (isLoading) {
```

Replace with:

```typescript
  const card = cards?.find((c) => c.cardId === cardId) ?? null;

  // Real-time stamp animation — no-op when card is null (still loading/missing)
  const { pendingAnimation } = useStampEvents(
    card?.cardId,
    card?.currentStamps ?? 0,
    account?.address,
  );

  // Loading state
  if (isLoading) {
```

- [ ] **Step 3: Pass `animateNewStamp` to `StampCard`**

Find the existing `<StampCard ... />` usage:

```typescript
        <StampCard
          themeId={card.themeId}
          merchantName={card.merchantName || "Unknown Merchant"}
          rewardDescription={card.rewardDescription || "Loyalty reward"}
          stampCount={card.currentStamps}
          totalStamps={card.stampsRequired}
          logoUrl={card.logoUrl}
        />
```

Replace with:

```typescript
        <StampCard
          themeId={card.themeId}
          merchantName={card.merchantName || "Unknown Merchant"}
          rewardDescription={card.rewardDescription || "Loyalty reward"}
          stampCount={card.currentStamps}
          totalStamps={card.stampsRequired}
          logoUrl={card.logoUrl}
          animateNewStamp={pendingAnimation}
        />
```

- [ ] **Step 4: Add QR panel after the last-stamped section**

Find the closing `</div>` of the content wrapper (after the `card.lastStampedAt` block):

```typescript
        {/* Last stamped date */}
        {card.lastStampedAt && (
          <div
            className="rounded-(--radius-xl) px-4 py-3 flex items-center justify-between"
            style={{
              background: theme.bgColor,
              border: `1.5px solid ${theme.inkColor}22`,
            }}
          >
            <p className="text-[12px] uppercase tracking-wide font-medium" style={{ color: theme.inkColor, opacity: 0.45 }}>
              Last stamp
            </p>
            <p className="text-[13px] font-semibold" style={{ color: theme.inkColor }}>
              {formatDate(card.lastStampedAt)}
            </p>
          </div>
        )}
      </div>
```

Replace with:

```typescript
        {/* Last stamped date */}
        {card.lastStampedAt && (
          <div
            className="rounded-(--radius-xl) px-4 py-3 flex items-center justify-between"
            style={{
              background: theme.bgColor,
              border: `1.5px solid ${theme.inkColor}22`,
            }}
          >
            <p className="text-[12px] uppercase tracking-wide font-medium" style={{ color: theme.inkColor, opacity: 0.45 }}>
              Last stamp
            </p>
            <p className="text-[13px] font-semibold" style={{ color: theme.inkColor }}>
              {formatDate(card.lastStampedAt)}
            </p>
          </div>
        )}

        {/* QR code panel — Apple Wallet style, merchant scans this to stamp */}
        {account && (
          <div
            className="flex flex-col items-center gap-3 py-5 px-4"
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-2xl)",
              boxShadow: "var(--shadow-card)",
              border: "1px solid var(--color-border)",
            }}
          >
            <BeautifulQR
              value={encodeCustomerCardQR(cardId, account.address)}
              size={180}
              label="Stamp card QR code"
              foregroundColor="#111111"
              backgroundColor="#ffffff"
            />
            <p className="text-[12px] text-(--color-text-muted)">
              Show this to the merchant to earn a stamp
            </p>
          </div>
        )}
      </div>
```

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

Expected: all tests pass (the hook unit test from Task 2 + any existing lib tests).

- [ ] **Step 6: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/customer/cards/[cardId]/page.tsx
git commit -m "feat(cards): add QR panel and real-time stamp animation to card detail page"
```

---

## Manual Verification Checklist

After implementation, verify end-to-end with two devices (or two browser tabs):

1. **QR visible**: Open `/customer/cards/[cardId]` — QR panel appears at the bottom of the card. QR encodes a `v1:` payload.
2. **QR scans correctly**: Open merchant scanner (`/merchant/[programId]`), tap "Scan Customer QR", point at the card detail QR — confirm panel appears with the customer address.
3. **Animation fires**: Tap "Issue Stamp" on merchant device → wait for blockchain confirm → customer card screen plays spring stamp animation on the new slot.
4. **No spurious animation on load**: Reload the card detail page with existing stamps — no animation fires.
5. **Reward complete banner**: Fill all stamp slots — "🎉 Reward ready!" banner appears inside the card (existing behaviour).
6. **WS fallback (optional)**: Block WebSocket connections in DevTools → issue a stamp → animation still fires within ~6 seconds via polling.
