---
title: "CTO Review — Tasks 5-7: Wallet Integration, Gas Sponsorship, Blockchain Queries"
date: 2026-03-25
status: authoritative
tags:
  - project/suiki
  - type/architecture-review
  - stage/implementation
---

# CTO Review: Tasks 5-7

This document is the authoritative implementation guide for Tasks 5 (wallet integration), 6 (gas sponsor API), and 7 (transaction builders, queries, and hooks). It records what already exists and is correct, what is broken or missing, exact API shapes to use from the v2 SDKs, and pitfalls to avoid.

---

## SDK Version Summary

All SDK facts below come from the versions locked in `package.json`:

| Package | Version | Key constraint |
|---|---|---|
| `@mysten/sui` | `^2.11.0` | `SuiClient` and `getFullnodeUrl` are REMOVED. Use `SuiGrpcClient` from `@mysten/sui/grpc`. Core API lives at `client.core.*`. |
| `@mysten/dapp-kit-react` | `^2.0.1` | `useSuiClientQuery` is REMOVED. Wallet kit is initialized with `createDAppKit` factory and rendered via `DAppKitProvider`. No mutation hooks — use `useDAppKit().signAndExecuteTransaction()`. |
| `@tanstack/react-query` | `^5.95.2` | Use `useCurrentClient` (from dapp-kit-react v2) + `useQuery` for all on-chain reads in Client Components. |

---

## Task 5 — Wallet Integration

### Files in scope

- `src/app/providers.tsx`
- `src/lib/sui-client.ts`
- `src/components/connect-wallet.tsx` (does not exist yet)

---

### `src/app/providers.tsx` — STATUS: CORRECT, complete

The file is architecturally sound and requires no changes for Task 5.

What it does correctly:
- Uses `createDAppKit` factory (not the old `createNetworkConfig` pattern).
- Passes a `createClient` factory that returns a `SuiGrpcClient` per network — correct v2 pattern.
- Wraps `DAppKitProvider` inside `QueryClientProvider` so React Query is available to all blockchain hooks.
- Uses `useState` factory for `QueryClient` to prevent the instance being shared across SSR requests.
- `staleTime: 60_000` is a reasonable default; individual hooks can override.
- `"use client"` directive is present and required.

No missing pieces.

---

### `src/lib/sui-client.ts` — STATUS: CORRECT for server use, but missing export

The `SuiGrpcClient` instantiation is correct. The `network` + `baseUrl` constructor shape matches `@mysten/sui/grpc` v2.

**Critical gap:** `queries.ts` imports `SuiClientInterface` from this file, but the file does not export that type. The type must be added so `queries.ts` compiles. The interface must describe the subset of `SuiGrpcClient` methods that `queries.ts` actually calls.

The correct exported interface shape:

```
export interface SuiClientInterface {
  queryEvents(params: {
    query: { MoveEventType: string };
    order?: 'ascending' | 'descending';
    cursor?: unknown;
    limit?: number;
  }): Promise<{ data: Array<{ parsedJson: unknown }> }>;

  multiGetObjects(params: {
    ids: string[];
    options: { showContent: boolean };
  }): Promise<Array<{ data?: { objectId: string; content: unknown } | null }>>;

  getObject(params: {
    id: string;
    options: { showContent: boolean };
  }): Promise<{ data?: { objectId: string; content: unknown } | null }>;
}
```

Note: The real `SuiGrpcClient` from `@mysten/sui/grpc` v2 exposes these under `client.core.*` (e.g., `client.core.getObject()`). Before writing the interface, verify in `node_modules/next/dist/docs/` and the installed type declarations whether `SuiGrpcClient` exposes a flat API or a namespaced `core` sub-object. The interface in `sui-client.ts` must match whichever shape the installed package actually exports — do not guess from training data.

**Additional note on the comment in sui-client.ts:** The JSDoc says "Use `useSuiClient()` from `@mysten/dapp-kit` in Client Components instead." This is wrong for v2. The correct instruction is: "Use `useCurrentClient()` from `@mysten/dapp-kit-react` in Client Components." Update the comment when adding the interface export.

---

### `src/components/connect-wallet.tsx` — STATUS: DOES NOT EXIST

This file must be created. It is a thin wrapper around the `ConnectButton` component exported by `@mysten/dapp-kit-react` v2.

Required contract:
- `"use client"` directive (it uses a hook internally).
- Named export `ConnectWallet` (not default, to stay consistent with existing component conventions).
- Accept optional `className?: string` prop to allow layout callers to control positioning.
- Render `<ConnectButton />` from `@mysten/dapp-kit-react`. Do not re-implement wallet connection logic.

Import to use: `import { ConnectButton } from '@mysten/dapp-kit-react'`

Before implementing, check the actual export name in `node_modules/@mysten/dapp-kit-react/dist/` — it may be `ConnectButton`, `WalletConnectButton`, or similar. Read the installed package exports rather than relying on training data.

---

## Task 6 — Gas Sponsor API Route

### File in scope

- `src/app/api/sponsor/route.ts`

### STATUS: STRUCTURALLY PRESENT but contains two critical v2 violations

The file exists and has correct logic for: JSON parsing, rate limiting (in-memory, acknowledged as pre-mainnet), PTB allowlist validation (all commands, not just first), and key loading.

**Critical Bug 1 — `SuiClient` and `getFullnodeUrl` are REMOVED in v2**

Line 28 imports:
```
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
```

And line 256 uses:
```
const client = new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) });
```

Both `SuiClient` and `getFullnodeUrl` do not exist in `@mysten/sui` v2. This will throw a module resolution error at runtime (or build time).

The server-side client singleton already exists at `src/lib/sui-client.ts` and is the correct replacement. The route must import and use that singleton instead of constructing a new client inline.

Replacement: `import { suiClient } from '@/lib/sui-client'` and use `suiClient` directly.

**Critical Bug 2 — `tx.sign()` is not the v2 execute pattern**

The current code calls `tx.sign({ client, signer })` and returns `{ bytes, signature }` back to the client. In v2 the sponsor's role is to:

1. Set itself as the gas owner on the transaction.
2. Sign the transaction bytes.
3. Return the signed bytes and sponsor signature to the client.
4. The client then adds its own user signature and submits.

The final execution is via `suiClient.core.executeTransaction()`, not done inside the sponsor route. The route's job ends at returning `{ transactionBytes, sponsorSignature }` — which the existing `SponsoredTxResponse` type already models correctly.

Before implementing, verify the exact v2 signing API from the installed type definitions:
- Check `node_modules/@mysten/sui/dist/` for the `Transaction` class sign method signature.
- Check `SuiGrpcClient.core.executeTransaction()` parameter shape.

**Bug 3 — `env.ts` is not used for `SPONSOR_PRIVATE_KEY`**

Line 242 reads `process.env.SPONSOR_PRIVATE_KEY` directly rather than importing from `@/env`. This bypasses the validated env module. Use `import { env } from '@/env'` and read `env.SPONSOR_PRIVATE_KEY`.

**Rate limit note (not a bug, but a clarification):** The requirement says "50 tx/merchant/day." The current implementation applies the 50-count limit keyed by `sender` address (which is the merchant) plus a separate IP limit. The sender-based limit correctly satisfies "per merchant per day." The IP limit adds extra protection but is independent. This design is acceptable for MVP.

**What is correct and should not be changed:**
- `ALLOWED_FUNCTIONS` set and `ALLOWED_MODULE` guard.
- `validateAllCommands` — iterates all commands, rejects non-MoveCall, rejects unauthorized targets.
- `checkRateLimit` — sliding 24-hour window logic.
- `Transaction.from(txKindBytes)` deserialization.
- `tx.setSenderIfNotSet(sender)`.
- The in-memory store TODO comment — acknowledge it's pre-mainnet only.
- The `SponsoredTxRequest` / `SponsoredTxResponse` type imports.

---

## Task 7 — Transaction Builders, Queries, and Hooks

### `src/lib/transactions.ts` — STATUS: STRUCTURALLY CORRECT, blocked by stub

All five builders (`buildCreateProgram`, `buildCreateCardAndStamp`, `buildIssueStamp`, `buildRedeem`, `buildUpdateProgram`) have correct Move call targets, correct argument order matching the Move function signatures, and correct use of `TARGETS` and `CLOCK_ID` from constants.

The only work needed is replacing the stub:
- Remove `TransactionInterface`, `newTransaction()`, and all associated TODO comments.
- Add `import { Transaction } from '@mysten/sui/transactions'`.
- Change all builder return types from `TransactionInterface` to `Transaction`.
- Change `newTransaction()` calls to `new Transaction()`.

The parameter types (`CreateProgramParams`, `CreateCardAndStampParams`, etc.) and the exported function signatures are all correct and should not be changed.

**Pitfall — `onlyTransactionKind` mode:** When `use-sponsored-tx.ts` builds a PTB destined for the sponsor endpoint, it must call `tx.build({ onlyTransactionKind: true })` to produce kind-only bytes (no gas data). This is not done inside the builders themselves — the builders return a bare `Transaction` and callers decide how to build. This design is correct. Document this clearly in `use-sponsored-tx.ts`.

---

### `src/lib/queries.ts` — STATUS: LOGIC CORRECT, but depends on missing `SuiClientInterface` export

The query functions `getMerchantPrograms`, `getCustomerCards`, `getProgramById`, and `findCardForProgram` have correct logic. The parse helpers (`parseStampProgram`, `parseStampCard`) correctly handle the `{ dataType: "moveObject", fields: {...} }` RPC envelope shape.

**Blocking issue:** The file imports `SuiClientInterface` from `./sui-client`, but that export does not exist yet. Adding it to `sui-client.ts` unblocks compilation.

**API shape concern — `queryEvents` vs `core.queryEvents`:** The current code calls `client.queryEvents(...)` directly. If `SuiGrpcClient` v2 namespaces event queries under `client.core.queryEvents()` (as it does for object queries), this will fail at runtime. The `SuiClientInterface` in `sui-client.ts` must match the actual method location. Verify by reading the installed type declarations before writing the interface.

**Pagination gap (known, acceptable for MVP):** All three event-based queries fetch the most recent events with no cursor. The comments acknowledge this. For production, add `limit` and `cursor` parameters. Do not fix for MVP.

**`findCardForProgram` — scans all events:** This function fetches all `CardCreated` events and searches client-side. For MVP with small data sets this is fine. Note it in the hook that calls it.

---

### `src/hooks/use-my-programs.ts` — STATUS: DOES NOT EXIST

Must be created. Correct pattern for dapp-kit-react v2:

```
"use client"
import { useCurrentClient } from '@mysten/dapp-kit-react'
import { useQuery } from '@tanstack/react-query'
import { useCurrentAccount } from '@mysten/dapp-kit-react'
import { getMerchantPrograms } from '@/lib/queries'

export function useMyPrograms() {
  const client = useCurrentClient()
  const account = useCurrentAccount()
  return useQuery({
    queryKey: ['merchant-programs', account?.address],
    queryFn: () => getMerchantPrograms(client, account!.address),
    enabled: !!account?.address,
  })
}
```

Key constraints:
- `useCurrentClient()` returns the live client configured by `DAppKitProvider` for the active network.
- `useCurrentAccount()` returns `null` when no wallet is connected — guard with `enabled: !!account?.address`.
- `queryKey` must include `account.address` so the cache is per-wallet.
- Do NOT call `useSuiClientQuery` — it does not exist in v2.
- The `client` object returned by `useCurrentClient()` must satisfy the `SuiClientInterface` defined in `sui-client.ts`. If the real client's method names differ (e.g., `client.core.queryEvents` vs `client.queryEvents`), the interface and query functions must both be updated consistently.

Verify exact hook names exported by `@mysten/dapp-kit-react` v2 from `node_modules/@mysten/dapp-kit-react/dist/` before writing.

---

### `src/hooks/use-my-cards.ts` — STATUS: DOES NOT EXIST

Identical pattern to `use-my-programs.ts`, but calls `getCustomerCards`. The customer's address is also the connected wallet address — no difference from the merchant hook in structure.

```
queryKey: ['customer-cards', account?.address]
queryFn: () => getCustomerCards(client, account!.address)
```

---

### `src/hooks/use-sponsored-tx.ts` — STATUS: DOES NOT EXIST

This is the most complex hook. It orchestrates the full sponsored transaction flow.

Required steps in order:

1. Accept a `buildTx: () => Transaction` callback (caller provides the transaction builder).
2. Call `buildTx()` to get the `Transaction` object.
3. Call `tx.build({ onlyTransactionKind: true })` to get kind-only bytes — these contain no gas data and are safe to send to the sponsor.
4. Base64-encode the bytes: `Buffer.from(kindBytes).toString('base64')` (or `btoa` in browser — prefer a utility that works in both).
5. `POST /api/sponsor` with `{ txKindBytes: base64string, sender: account.address }`.
6. Receive `{ transactionBytes, sponsorSignature }` from the server.
7. Get the user signature: `const { signature: userSignature } = await useDAppKit().signAndExecuteTransaction(...)`.

**Stop — critical design question for step 7:** The `signAndExecuteTransaction` helper from dapp-kit-react v2 may combine signing AND execution in one call. If so, the sponsored flow needs a different approach: call a pure sign method (e.g., `signTransaction`) to get only the user's signature without executing, then submit the transaction to the chain with both signatures via `suiClient.core.executeTransaction({ transactionBytes, signatures: [userSignature, sponsorSignature] })`.

Before writing this hook, read the dapp-kit-react v2 docs in `node_modules/next/dist/docs/` and the installed package types to determine:
- Whether a `signTransaction` (sign-only, no execute) method is available.
- The exact parameter shape for `executeTransaction` on `SuiGrpcClient`.
- Whether `useDAppKit()` is the correct hook to obtain signing capability.

**Hook return shape:**

```typescript
{
  mutate: (buildTx: () => Transaction) => void,
  isPending: boolean,
  isSuccess: boolean,
  isError: boolean,
  error: Error | null,
  data: ExecuteTransactionResult | null,
}
```

Use `useMutation` from `@tanstack/react-query` to manage async state. Do not use `useState` + manual async state — `useMutation` is already available and handles loading/error/success correctly.

**Rate limit awareness:** The hook must handle HTTP 429 responses from `/api/sponsor` and surface a user-readable error ("Rate limit exceeded — try again tomorrow").

---

## Cross-Cutting Pitfalls

### 1. `SuiClient` / `getFullnodeUrl` are removed in v2

Any file that imports from `@mysten/sui/client` using these names will fail. The server client is `SuiGrpcClient` from `@mysten/sui/grpc`. Check every file before writing.

### 2. `useSuiClientQuery` does not exist in dapp-kit-react v2

Do not use it. The replacement pattern is `useCurrentClient()` + `useQuery()` from `@tanstack/react-query`.

### 3. `client.core.*` namespacing

In `@mysten/sui` v2, the gRPC client may namespace its methods under a `core` sub-object (e.g., `client.core.getObject()`, `client.core.listOwnedObjects()`). The current `queries.ts` calls methods directly on the client (`client.queryEvents()`, `client.multiGetObjects()`). If the actual installed API is namespaced, all query functions and the `SuiClientInterface` must be updated to match. Read the type declarations from the installed package — do not assume.

### 4. The stub in `transactions.ts` throws at runtime

`newTransaction()` throws unconditionally. Until the stub is replaced with a real `Transaction` import, any code path that calls a builder function will crash immediately. The transaction builders cannot be tested or used until this is resolved.

### 5. `SPONSOR_PRIVATE_KEY` key format

The current route attempts `Ed25519Keypair.fromSecretKey(Buffer.from(key, 'base64'))`. The Ed25519Keypair v2 API may expect a different format (e.g., bech32 Sui secret key, or raw 32-byte seed). Verify the exact `fromSecretKey` / `fromSecretKeyBase64` method signature in the installed package before writing. Using the wrong format will produce a silent incorrect key or throw on instantiation.

### 6. Shared objects require mutable reference handling

`StampProgram` is a shared object passed as `&mut` in `create_card_and_stamp`, `issue_stamp`, and `update_program`. In the transaction builder, `tx.object(programId)` is correct for this — SUI's PTB builder resolves shared object reference kind (immutable vs mutable) from on-chain object metadata when building. No additional flags are needed in the transaction builder.

### 7. `queries.ts` event filter scans all events

`getMerchantPrograms` and `getCustomerCards` fetch all events of a type and filter client-side by address. On testnet with few merchants this is fine. For production, filter at the RPC level if the SUI gRPC event query API supports sender/emitter filters. Revisit before mainnet.

### 8. `findCardForProgram` is called in the merchant stamp flow

This is the function that determines whether to call `create_card_and_stamp` (new customer) or `issue_stamp` (returning customer). It will return stale data if events are indexed with delay. Accept this risk for MVP; the Move contract enforces correct state regardless.

### 9. `providers.tsx` creates the `dAppKit` instance at module level

`createDAppKit({...})` is called once at module initialization, not inside a component. This is correct behavior — the factory is meant to be called once. Do not move it inside the component or into `useState`.

### 10. Environment guard in `route.ts` checks `PACKAGE_ID === '0x_PLACEHOLDER'`

This guard correctly prevents the sponsor from operating before the Move package is deployed. When the package is deployed and `NEXT_PUBLIC_PACKAGE_ID` is updated, the guard passes automatically. No code change needed at deploy time.

---

## Implementation Order

Tasks within this sprint should be implemented in this order to avoid blocked dependencies:

1. Add `SuiClientInterface` export to `src/lib/sui-client.ts` — unblocks `queries.ts` compilation.
2. Fix `src/lib/transactions.ts` stub — replace with real `Transaction` import.
3. Fix `src/app/api/sponsor/route.ts` — replace `SuiClient`/`getFullnodeUrl` with `suiClient` singleton; fix signing flow; use `env.SPONSOR_PRIVATE_KEY`.
4. Create `src/components/connect-wallet.tsx`.
5. Create `src/hooks/use-my-programs.ts`.
6. Create `src/hooks/use-my-cards.ts`.
7. Create `src/hooks/use-sponsored-tx.ts` (most complex — do last, after signing API is understood).

---

## Files to Create (net new)

| File | Task |
|---|---|
| `src/components/connect-wallet.tsx` | 5 |
| `src/hooks/use-my-programs.ts` | 7 |
| `src/hooks/use-my-cards.ts` | 7 |
| `src/hooks/use-sponsored-tx.ts` | 7 |

## Files to Modify (exist, need fixes)

| File | Task | Change |
|---|---|---|
| `src/lib/sui-client.ts` | 5/7 | Add `SuiClientInterface` export; fix JSDoc comment about `useSuiClient` |
| `src/lib/transactions.ts` | 7 | Replace stub with real `Transaction` import from `@mysten/sui/transactions` |
| `src/app/api/sponsor/route.ts` | 6 | Remove `SuiClient`/`getFullnodeUrl`; use `suiClient` singleton; fix sign/execute; use `env.SPONSOR_PRIVATE_KEY` |

## Files That Are Correct — Do Not Change

| File | Reason |
|---|---|
| `src/app/providers.tsx` | v2-correct `createDAppKit` + `DAppKitProvider` setup |
| `src/lib/constants.ts` | Correct `TARGETS`, `CLOCK_ID`, `EVENT_TYPES` |
| `src/env.ts` | Correct t3-oss env validation with all required vars |
| `src/types/sui.ts` | Complete and correct branded types, raw RPC shapes, and API types |
| `src/lib/queries.ts` | Logic correct; only blocked by missing `SuiClientInterface` |
