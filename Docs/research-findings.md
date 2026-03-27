# Research Findings: Suiki Stack Best Practices

**Date**: 2026-03-26
**Focus**: Next.js 16, React 19, @mysten/dapp-kit-react v2, @mysten/sui v2, TanStack Query v5, Tailwind CSS v4, TypeScript 5, Vitest v4

---

## 1. Next.js 16 App Router (Breaking Changes from 15)

### Async Route Parameters (Critical Breaking Change)

**Issue**: Next.js 15 introduced async `params` and `searchParams`, but with temporary synchronous compatibility. **Next.js 16 removes synchronous access entirely.**

**Old Pattern (Next.js 15)** - Now broken:
```tsx
export default function Page({ params, searchParams }) {
  const { slug } = params  // ❌ No longer works
  const { query } = searchParams
}
```

**New Pattern (Next.js 16)** - Required:
```tsx
import { use } from 'react'

type Params = Promise<{ slug: string }>
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default function Page(props: {
  params: Params
  searchParams: SearchParams
}) {
  const params = use(props.params)
  const searchParams = use(props.searchParams)
  const slug = params.slug
  const query = searchParams.query
}
```

**For API routes and Server Components**: All calls to `cookies()`, `headers()`, `draftMode()`, and params must be awaited:
```tsx
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
}
```

### Configuration Changes

**`serverExternalPackages`** is now stable (no longer experimental):
```javascript
// ✅ next.config.ts
const nextConfig: NextConfig = {
  serverExternalPackages: ['@mysten/sui'], // List packages that should run on server only
}
```

**`skipProxyUrlNormalize`** replaces deprecated `skipMiddlewareUrlNormalize`:
```javascript
const nextConfig: NextConfig = {
  skipProxyUrlNormalize: true, // Disables URL normalization for the new proxy system
}
```

**Removed**: `experimental.dynamicIO` flag is now integrated into core behavior.

---

## 2. React 19 (New Features & Patterns)

### Server Actions (use server)

Server Actions are async functions marked with `"use server"` that run on the server and can be called from Client Components:

```tsx
// actions.ts
'use server'

export async function updateStampCard(cardId: string) {
  // Server-side logic, direct database access
  const result = await db.stampCards.update(cardId, { stampsCount: n + 1 })
  return { success: true, newCount: result.stampsCount }
}
```

Call from Client Component:
```tsx
'use client'

import { useTransition } from 'react'
import { updateStampCard } from './actions'

export function StampButton() {
  const [isPending, startTransition] = useTransition()

  const handleStamp = () => {
    startTransition(async () => {
      const result = await updateStampCard('card-123')
      if (result.success) console.log('Stamped:', result.newCount)
    })
  }

  return <button onClick={handleStamp} disabled={isPending}>Add Stamp</button>
}
```

### useActionState Hook

For progressive enhancement and form integration:

```tsx
'use client'

import { useActionState } from 'react'
import { requestUsername } from './actions'

export function UsernameForm() {
  const [state, action] = useActionState(requestUsername, null)

  return (
    <form action={action}>
      <input type="text" name="username" />
      <button type="submit">Request</button>
      {state?.error && <span>{state.error}</span>}
      {state?.success && <span>Success!</span>}
    </form>
  )
}
```

### Key Pattern for React 19

- Server Components are the default; use `'use client'` at the top of files that need interactivity.
- Server Actions reduce network hops for mutations (no need for separate API routes in many cases).
- Use `useTransition` to show loading states during server action execution.

---

## 3. @mysten/dapp-kit-react v2 (NOT deprecated v1)

### Initialization in Providers

**Required pattern** (from `src/app/providers.tsx`):

```tsx
import { createDAppKit } from '@mysten/dapp-kit-core'
import { DAppKitProvider } from '@mysten/dapp-kit-react'
import { SuiGrpcClient } from '@mysten/sui/grpc'

const GRPC_URLS = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
}

const dAppKit = createDAppKit({
  networks: ["testnet", "mainnet", "devnet"] as const,
  defaultNetwork: "testnet",
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
})

// TypeScript augmentation for full typing
declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: { queries: { staleTime: 60 * 1000 } },
    })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>{children}</DAppKitProvider>
    </QueryClientProvider>
  )
}
```

### Key Hooks

- `useDAppKit()` - Access the dAppKit instance
- `useCurrentAccount()` - Get connected wallet address
- `signAndExecuteTransaction()` - Sign + execute in one step
- `signTransaction()` - Sign only (for multi-sig or sponsored flows)

**Do NOT use deprecated `@mysten/dapp-kit`** — only v2 from `@mysten/dapp-kit-react`.

---

## 4. @mysten/sui v2 (gRPC Client & Transaction Patterns)

### Transaction Building & Execution

**Pattern 1: Direct execution (user pays gas)**
```tsx
const tx = new Transaction()
tx.moveCall({
  target: `${PACKAGE_ID}::module::function`,
  arguments: [tx.object(objectId)],
})

const result = await dAppKit.signAndExecuteTransaction({ transaction: tx })

if (result.$kind === 'FailedTransaction') {
  throw new Error(`Failed: ${result.FailedTransaction.status.error?.message}`)
}

const digest = result.Transaction.digest
```

**Pattern 2: Sponsored transaction (gas sponsor pays)**

From `src/hooks/use-sponsored-tx.ts`, the correct flow is:

1. Set sender on transaction: `tx.setSender(account.address)`
2. Build unsigned kind bytes: `await tx.build({ client, onlyTransactionKind: true })`
3. Send to sponsor API for gas attachment
4. Sponsor signs the full transaction bytes
5. User signs the sponsored bytes: `signTransaction(Transaction.from(sponsoredBytes))`
6. Execute with both signatures: `executeTransaction(bytes, [userSig, sponsorSig])`
7. **Check result for success**: Must check `result.$kind === 'FailedTransaction'`
8. **Wait for indexing**: `await client.waitForTransaction({ digest })`
9. Invalidate caches

### Critical: Result Checking

Always check transaction results before considering them successful:

```tsx
const result = await dAppKit.getClient().core.executeTransaction({
  transaction: transactionBytes,
  signatures: [userSignature, sponsorSignature],
})

// ✅ Check for on-chain failure
if (result.$kind === 'FailedTransaction') {
  const reason = result.FailedTransaction.status.success
    ? 'unknown error'
    : result.FailedTransaction.status.error.message
  throw new Error(`Transaction failed: ${reason}`)
}

const confirmedDigest = result.Transaction.digest
```

### Waiting for Transaction

Do NOT assume execution is complete when you get a digest. Poll for indexing:

```tsx
await dAppKit.getClient().core.waitForTransaction({
  digest: confirmedDigest,
  options: { showEffects: true },
})
```

### gRPC Client (Server-Side Only)

**Suiki imports `SuiGrpcClient` in `src/lib/sui-client.ts` — this is correct** for server-side queries. Never use JSON-RPC on the server.

```tsx
import { SuiGrpcClient } from '@mysten/sui/grpc'

const suiClient = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
})

// Server-side only
const balance = await suiClient.getBalance({ owner: walletAddress })
```

---

## 5. TanStack Query v5 (React Query)

### Invalidation Strategy

**Key change from v4**: `refetchActive` / `refetchInactive` → `refetchType`:

```tsx
// v5 syntax
await queryClient.invalidateQueries({
  queryKey: ['cards', accountAddress],
  refetchType: 'active', // only refetch if component is mounted
})

// Options: 'active' (default), 'inactive', 'all', 'none'
```

**Ordering matters**: In Suiki's `use-sponsored-tx.ts`, invalidations happen AFTER `waitForTransaction`:

```tsx
// ✅ Correct order
const confirmedDigest = result.Transaction.digest
await dAppKit.getClient().core.waitForTransaction({ digest: confirmedDigest })
setDigest(confirmedDigest)

// THEN invalidate
await queryClient.invalidateQueries({ queryKey: ['programs', account.address] })
await queryClient.invalidateQueries({ queryKey: ['cards', account.address] })
```

### Stale Time Configuration

From `src/app/providers.tsx`:

```tsx
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 60 seconds — data won't refetch until after this
    },
  },
})
```

**Best practice**: Longer `staleTime` reduces redundant network requests. Invalidate manually when you know data changed (e.g., after a transaction).

### Enabled Flag for Conditional Queries

```tsx
const { data } = useQuery({
  queryKey: ['userCards', userId],
  queryFn: fetchCards,
  enabled: !!userId, // Don't run until userId is available
})
```

---

## 6. Tailwind CSS v4 (Breaking Changes from v3)

### CSS Import Syntax Change

**Old (v3)**:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**New (v4)**:
```css
@import "tailwindcss";
```

Run the upgrade tool to handle this automatically:
```bash
npx @tailwindcss/upgrade
```

### Utility Renames

- `outline-none` → `outline-hidden` (in forced colors mode, none was still visible)
- New `outline-none` truly sets `outline-style: none`

### CLI Changes

```bash
# v3
npx tailwindcss -i input.css -o output.css

# v4
npx @tailwindcss/cli -i input.css -o output.css
```

---

## 7. TypeScript 5 Strict Mode

### Enable Strict Mode

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,  // Enables all strict checks
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

### Benefits

- Catches `null` / `undefined` errors at compile time
- Prevents implicit `any` types
- Better refactoring safety
- Suiki uses strict mode — maintain it.

### Type Patterns for Env Vars

Use `@t3-oss/env-nextjs` for safe env access (as Suiki does in `src/env.ts`):

```tsx
export const env = createEnv({
  server: {
    SPONSOR_PRIVATE_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_SUI_NETWORK: z.enum(["testnet", "mainnet", "devnet"]),
    NEXT_PUBLIC_PACKAGE_ID: z.string(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
```

---

## 8. Vitest v4 (Unit Testing)

### Setup Files

Vitest setup runs before each test file:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./src/__tests__/setup.ts'],
  },
})
```

```typescript
// src/__tests__/setup.ts
import { afterEach } from 'vitest'

afterEach(() => {
  // Cleanup after each test
})
```

### Async Tests and Waiting

```typescript
import { expect, test, vi } from 'vitest'

test('async operation completes', async () => {
  const result = await someAsyncFunction()
  expect(result).toBe('expected')
})

// Wait for async conditions
test('waits for server', async () => {
  const server = createServer()

  await vi.waitFor(() => {
    if (!server.isReady) throw new Error('Not ready')
  }, { timeout: 500, interval: 20 })

  expect(server.isReady).toBe(true)
})
```

### Note on Component Tests

Suiki's config excludes `*.test.tsx` (component tests) because `jsdom` and `@testing-library/react` are not yet added. Only `*.test.ts` lib tests run. See `Docs/qa-dependencies-needed.md`.

---

## 9. Common Pitfalls & Patterns

### Sponsored Transactions

**Pitfall 1**: Not checking transaction result before declaring success.
```tsx
// ❌ Wrong
const result = await executeTransaction(...)
setDigest(result.Transaction.digest)  // May be FailedTransaction!

// ✅ Correct
if (result.$kind === 'FailedTransaction') {
  throw new Error(...)
}
const digest = result.Transaction.digest
```

**Pitfall 2**: Not waiting for indexing before invalidating queries.
```tsx
// ❌ Wrong
const result = await executeTransaction(...)
queryClient.invalidateQueries(...)  // Data might not be indexed yet

// ✅ Correct
await client.waitForTransaction({ digest })
queryClient.invalidateQueries(...)
```

### Query Invalidation Ordering

Multiple invalidations should happen in sequence (as Suiki does):
```tsx
await queryClient.invalidateQueries({ queryKey: ['programs', address] })
await queryClient.invalidateQueries({ queryKey: ['cards', address] })
```

This ensures the first refetch completes before the second starts.

### Env Var Access

**Server vs. Client**:
- Server-side: can use both `SPONSOR_PRIVATE_KEY` and `NEXT_PUBLIC_*` vars
- Client-side: only `NEXT_PUBLIC_*` vars
- Use `src/env.ts` to validate all vars at build time

### React 19 & Next.js 16 Params

Always use `use()` hook to unwrap async params in client/server boundaries:
```tsx
import { use } from 'react'

export default function Page(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params)  // ✅ Required
  return <div>{params.id}</div>
}
```

---

## 10. Architecture Alignment (Suiki Current Practices)

✅ **Already Correct**:
1. `src/lib/sui-client.ts` — Single server-side `SuiGrpcClient` instance
2. `src/hooks/use-sponsored-tx.ts` — Proper flow: sign → sponsor → sign → execute → wait → invalidate
3. `src/app/providers.tsx` — Correct provider nesting (QueryClient → DAppKit)
4. `src/env.ts` — Safe env var validation with Zod
5. Transaction result checking for `FailedTransaction`
6. Use of `waitForTransaction()` before cache invalidation

⚠️ **Monitor**:
- Ensure all new code uses Next.js 16 async params pattern
- Use React 19 Server Actions for mutations when appropriate
- Keep `staleTime` configuration for performance tuning
- Continue awaiting async calls in Server Components

---

## 11. Quick Reference: Do's and Don'ts

| Pattern | ✅ Do | ❌ Don't |
|---------|-------|---------|
| Import dApp Kit | `@mysten/dapp-kit-react` v2 | `@mysten/dapp-kit` (deprecated) |
| Server RPC client | `SuiGrpcClient` | JSON-RPC `SuiClient` on server |
| Next.js params | Use `use()` hook on promises | Direct destructuring |
| Transaction results | Check `$kind === 'FailedTransaction'` | Assume digest = success |
| After execution | Call `waitForTransaction()` | Invalidate caches immediately |
| Tailwind v4 CSS | `@import "tailwindcss"` | `@tailwind` directives |
| Env vars (client) | Prefix with `NEXT_PUBLIC_` | Use server-only vars in browser |
| Tests | `*.test.ts` (lib) | `*.test.tsx` (excluded) |
| Server Actions | Return `{ success, error }` | Throw errors directly |

---

## References

- **Next.js 16 Docs**: `node_modules/next/dist/docs/` (breaking changes)
- **React 19**: `react.dev` (Server Actions, `use()` hook)
- **@mysten/dapp-kit v2**: `sdk.mystenlabs.com/dapp-kit/`
- **@mysten/sui v2**: `sdk.mystenlabs.com/sui/`
- **TanStack Query v5**: `tanstack.com/query/v5/`
- **Tailwind CSS v4**: `tailwindcss.com/docs/upgrade-guide`
- **TypeScript 5**: `typescriptlang.org/docs/`
- **Vitest v4**: `vitest.dev/`

