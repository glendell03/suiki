# Stamp Card QR + Real-Time Stamp Animation

**Date:** 2026-03-28
**Status:** Approved
**Branch:** feat/v3-data-architecture

---

## Overview

Add a QR code to the customer stamp card detail page (Apple Wallet style) so customers can show their card directly to the merchant scanner. When the merchant scans and confirms the stamp on-chain, the customer's screen plays the stamp animation in real time via Sui event subscription with a polling fallback.

No Move contract changes required — `StampIssued` events are already emitted with `card_id`, `customer`, and `new_count`.

---

## Goals

- Customer opens their stamp card → QR code is visible at the bottom (no separate scan page needed for this flow)
- Merchant scans QR → existing flow unchanged (decode → confirm → blockchain tx)
- After tx confirms on-chain → customer's card screen animates the new stamp slot
- `/customer/scan` page remains as-is (wallet-level QR, separate use case)

---

## Architecture

```
Customer's phone (/customer/cards/[cardId])
├── ThemedStampGrid (existing, animateNewStamp prop)
├── BeautifulQR (existing component) — encodeCustomerCardQR(cardId, walletAddress)
│   └── Styled as Apple Wallet bottom panel (white card section, centered QR)
└── useStampEvents(cardId, currentStamps) — NEW hook
    ├── PRIMARY: SuiClient WebSocket → subscribes to StampIssued events filtered by card_id
    │   └── On event: onNewStamp(new_count) → animateNewStamp = true for one render cycle
    └── FALLBACK: if WS errors/closes → 3s TanStack Query refetchInterval on card object
        └── Detects stamp count increase → same animation trigger

Merchant's phone (/merchant/[programId]) — UNCHANGED
└── QrScanner → decodeQRPayload → handleScan → confirm → blockchain tx
    (existing flow, no changes needed)
```

---

## Section 1 — QR Code on Stamp Card

**File:** `src/app/customer/cards/[cardId]/page.tsx`

**Placement:** Below the `ThemedStampGrid`, inside the card surface. A dedicated white panel at the bottom of the card — matching the Apple Wallet pattern where the QR is visually separated from the card body.

**Encoding:** `encodeCustomerCardQR(cardId, walletAddress)` — same `v1:` base64 payload the merchant scanner already decodes. No changes to `qr-utils.ts`.

**Component:** `BeautifulQR` (already in the codebase at `@/components/beautiful-qr`). Size: 180px. Foreground: `#111111`, background: `#ffffff`.

**Visual design:**
- Rounded white panel (`border-radius: var(--radius-2xl)`, subtle shadow)
- Centered QR with a small label: "Scan to stamp" in `--color-text-muted`
- Sits below the stamp grid within the card detail layout
- Not shown on the list view (`/customer/cards`) — card detail only

---

## Section 2 — Stamp Event Hook

**File:** `src/hooks/use-stamp-events.ts` (new)

**Signature:**
```typescript
function useStampEvents(
  cardId: string | undefined,
  currentStamps: number,
): { pendingAnimation: boolean }
```

**Primary path — Sui WebSocket subscription:**

Uses a client-side `SuiClient` (JSON-RPC, not the server-side gRPC singleton) to subscribe to Move events. Filter by package — then match `card_id` in the handler (the SDK's `SuiEventFilter` does not support compound field filters in all versions):

```typescript
const unsubscribe = await suiBrowserClient.subscribeEvent({
  filter: { Package: PACKAGE_ID },
  onMessage(event) {
    if (event.type !== `${PACKAGE_ID}::suiki::StampIssued`) return;
    const fields = event.parsedJson as { card_id: string; new_count: string };
    if (fields.card_id !== cardId) return;
    const newCount = Number(fields.new_count);
    if (newCount > lastKnownStampsRef.current) {
      lastKnownStampsRef.current = newCount;
      setPendingAnimation(true);
    }
  },
});
```

The `StampIssued` event struct (already on-chain):
```
{ card_id: ID, program_id: ID, customer: address, new_count: u64, staffer: address }
```

When `new_count > currentStamps`, set `pendingAnimation = true` for one render cycle (reset after the animation frame via `useEffect`).

**Fallback path — polling:**

If the WebSocket connection errors or closes unexpectedly, the hook switches to polling mode using an **internal isolated query** (not `useMyCards`, to avoid polling all cards):

```typescript
useQuery({
  queryKey: ['card-stamp-poll', cardId],
  queryFn: () => suiBrowserClient.getObject({ id: cardId, options: { showContent: true } }),
  refetchInterval: 3000,
  enabled: wsFailedRef.current && !!cardId,
  select: (data) => extractStampCount(data), // parse current_stamps from object content
});
```

When the polled `currentStamps` exceeds `lastKnownStampsRef.current`, the same animation trigger fires. The hook attempts WebSocket reconnection after 5 seconds.

**Cleanup:** Unsubscribes from the WebSocket on unmount. Clears polling interval on unmount.

**Client-side SuiClient instantiation:**

A lightweight client-side instance (separate from the server-side gRPC singleton):
```typescript
// src/lib/sui-client-browser.ts (new, tiny file)
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { env } from '@/env';

export const suiBrowserClient = new SuiClient({
  url: getFullnodeUrl(env.NEXT_PUBLIC_SUI_NETWORK),
});
```

This does NOT violate the server-only constraint — the gRPC singleton in `src/lib/sui-client.ts` remains server-only. This browser client is used only in client components/hooks.

---

## Section 3 — Animation Trigger

**File:** `src/app/customer/cards/[cardId]/page.tsx`

`ThemedStampGrid` already accepts `animateNewStamp: boolean`. When `useStampEvents` returns `pendingAnimation: true`:

1. Pass `animateNewStamp={true}` to `ThemedStampGrid`
2. The newly earned stamp slot plays: `scale 0→1, rotate -20→0` (spring, stiffness 380, damping 14) + ripple effect
3. `pendingAnimation` resets to `false` after the animation frame — grid returns to static display

No changes needed to `ThemedStampGrid` or `StampSlot`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/customer/cards/[cardId]/page.tsx` | Add `BeautifulQR` panel + wire `useStampEvents` + pass `animateNewStamp` |
| `src/hooks/use-stamp-events.ts` | New — WebSocket subscription + polling fallback |
| `src/lib/sui-client-browser.ts` | New — client-side SuiClient for browser WebSocket use |

## Files Unchanged

- `src/lib/qr-utils.ts` — no changes
- `src/components/qr-scanner.tsx` — no changes
- `src/app/merchant/[programId]/page.tsx` — no changes
- `src/components/stamp-slot.tsx` — no changes
- `move/suiki/sources/suiki.move` — no changes (events already emitted)
- `src/app/customer/scan/page.tsx` — no changes (kept as wallet-level QR)

---

## Edge Cases

- **No card yet**: The card detail page (`/customer/cards/[cardId]`) is only reachable when a card object exists; `cardId` will always be a valid Sui object ID at this route. The hook is a no-op when `cardId` is `undefined` (e.g. during SSR or before hydration).
- **Multiple tabs open**: Each tab maintains its own WebSocket subscription — this is fine; animation fires on all open tabs.
- **Stamp count already ahead** (page loaded after stamp was issued): The hook initialises `lastKnownStamps` from `currentStamps` on mount, so no spurious animation fires on initial load.
- **Reward redemption** reduces stamp count — hook must not fire animation when count decreases.
- **Network offline**: Polling will fail silently (TanStack Query handles retry); no user-visible error needed.

---

## Dependencies

No new npm packages required. Uses:
- `@mysten/sui/client` — already installed (used server-side; browser usage is valid)
- `BeautifulQR` — already in codebase
- `framer-motion` — already in codebase (animation)
- `@tanstack/react-query` — already in codebase (polling fallback)
