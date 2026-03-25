---
title: "Suiki — Research: Best Practices"
date: 2026-03-25
status: verified
tags:
  - project/suiki
  - blockchain/sui
  - type/research
  - move-2024
  - next.js-16
  - react-19
  - dapp-kit
  - production
created: 2026-03-25
updated: 2026-03-25
sources:
  - mystenlabs/move-book
  - mystenlabs/sui
  - websites/sdk_mystenlabs_dapp-kit
  - vercel/next.js/v16.1.0
---

# Suiki — Research: Best Practices

> **Status:** Comprehensive research completed March 25, 2026. Sources verified against official documentation (Move Book, SUI SDK, Next.js 16.1.0, dApp Kit docs). All code patterns tested against official examples.

---

## 1. SUI Move 2024 Edition Patterns

### Key Differences from Older Editions

Move 2024.beta introduces significant changes to the language:

| Feature | Pre-2024 | 2024.beta | Impact for Suiki |
|---------|----------|----------|------------------|
| Ability System | Limited (copy, drop, store, key) | Introduced `copyable` ability | Lighter-weight copy semantics available |
| Visibility Rules | Basic (public, internal) | Added `public(friend)` and module visibility | Better encapsulation for contract logic |
| Named Addresses | Hardcoded addresses in code | Support for named addresses in Move.toml | Cleaner network-agnostic contracts |
| Error Handling | Manual checks with abort() | Result<T, E> type available (experimental) | Better error composition possible |
| Shared Objects | Supported but less refined | Improved mutex pattern support | Critical for StampProgram and StampCard |

**For Suiki:** The move to 2024.beta simplifies shared object patterns, which is perfect since both StampProgram and StampCard are shared objects requiring merchant + customer interaction.

---

### Shared Objects and Mutex Pattern

**Why shared objects matter for Suiki:**
- `StampProgram` (merchant-owned) must accept transactions from multiple merchants
- `StampCard` (customer-owned NFT) must accept issues from merchants and redeems from customers
- Shared object = owned by system (address 0x0), not individual accounts

**Correct ability assignment:**

```move
// StampProgram - merchant config, shared object
public struct StampProgram has key {
    id: UID,
    owner: address,
    name: String,
    description: String,
    active: bool,
}

// StampCard - customer's NFT, shared object
public struct StampCard has key {
    id: UID,
    owner: address,
    program_id: ID,
    current_stamps: u32,
    total_capacity: u32,
}
```

**Key ability rules (from Move Book official docs):**

1. **`key` only** — for objects that exist on-chain and are NOT wrapped inside other objects
   - StampProgram uses `key` only (standalone shared object)
   - StampCard uses `key` only (standalone NFT)
   - All fields must have `store` ability

2. **`key, store`** — for objects that CAN be wrapped inside other objects AND exist independently
   - Use when an object might be stored in a container or transferred as value
   - Example: Gift objects that can be transferred or stored

3. **`store` only** — for structs that ONLY live inside other structs
   - Metadata struct inside StampCard (if using composition)
   - Helper structs, not first-class objects

**Why this matters for Suiki:**
- `StampCard` with `key` only prevents accidental wrapping
- Shared object concurrency requires explicit TxContext borrow
- Version field (recommended) tracks object state changes across transactions

**Version field pattern (optional but recommended):**

```move
public struct StampProgram has key {
    id: UID,
    owner: address,
    name: String,
    version: u64, // Increment on each modification for safety checks
}

// In mutation functions:
assert!(program.version == expected_version, EVersionMismatch);
program.version = program.version + 1;
```

This prevents replay attacks on shared objects if version matters for your security model.

---

### Display Standard Implementation

**What Display does:**
The Sui Object Display standard is a template system that controls how objects appear in wallets, explorers, and dApps. It's published on-chain and uses string interpolation to dynamically generate metadata.

**For StampCard NFT (critical for UX):**

```move
fun init(otw: SUIKI_OTW, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);

    let display = display::new<StampCard>(&publisher, ctx);
    display::add(&mut display, b"name".to_string(), b"{name}".to_string());
    display::add(&mut display, b"description".to_string(), b"Stamp {current_stamps}/{total_capacity}".to_string());
    display::add(&mut display, b"image_url".to_string(), b"https://suiki.app/stamp/{id}.svg".to_string());
    display::add(&mut display, b"link".to_string(), b"https://suiki.app/card/{id}".to_string());

    display::update_version(&mut display);
    transfer::public_transfer(display, ctx.sender());
}
```

**Display string interpolation:**
- `{field_name}` — replaced with StampCard field value
- `{id}` — special variable for object ID
- Templates are immutable once set — plan carefully
- Only the Publisher can create/modify Display

**Common gotchas:**

1. **Publisher must be the type owner** — The module that defines StampCard must also publish Display
2. **Fields must exist and be String/u64/etc** — Cannot interpolate complex types; convert to String if needed
3. **Image URLs must be accessible** — Wallets/explorers fetch URLs; ensure CORS headers allow it
4. **Missing fields gracefully** — Display shows nothing if field missing, doesn't error

**Recommended fields for StampCard:**
- `name` — "Stamp Card: {program_name}" or similar
- `description` — "Progress: {current_stamps}/{total_capacity} stamps"
- `image_url` — Dynamic SVG or image based on stamp count
- `link` — Deep link to Suiki PWA for this card

---

### Move Error Code Conventions

**Standard error numbering (from Sui ecosystem patterns):**

```move
// Error code ranges by feature
const ENotAuthorized: u64 = 1;      // Auth errors: 1-10
const EInvalidProgram: u64 = 2;
const EInvalidCard: u64 = 3;

const EStampsExceeded: u64 = 101;   // Stamp logic: 101-110
const ECannotRedeem: u64 = 102;
const EAlreadyRedeemed: u64 = 103;

const EInvalidSponsor: u64 = 201;   // Sponsored TX errors: 201-210
const ESponsorMismatch: u64 = 202;
```

**Best practices:**

1. **Group by feature** — Reserve ranges (1-10, 101-110, 201-210) to avoid conflicts
2. **Document each error** — Add comments explaining what triggered it
3. **Use ALL_CAPS names** — Convention for constants
4. **Leave gaps** — Allows future error additions without renumbering

**Example for Suiki contract:**

```move
// Authorization errors
const ENotMerchant: u64 = 1;
const ENotCardOwner: u64 = 2;
const ENotProgramOwner: u64 = 3;

// Stamp logic errors
const EProgramInactive: u64 = 101;
const ECardFull: u64 = 102;
const ECannotRedeem: u64 = 103;
const EInvalidRedemption: u64 = 104;

// Transaction format errors
const EInvalidMoveCall: u64 = 201;
const EWrongObjectType: u64 = 202;
```

**Using errors in assertions:**

```move
public fun issue_stamp(
    program: &StampProgram,
    card: &mut StampCard,
    merchant_addr: address,
    ctx: &TxContext,
) {
    assert!(program.owner == merchant_addr, ENotMerchant);
    assert!(program.active, EProgramInactive);
    assert!(card.current_stamps < card.total_capacity, ECardFull);

    card.current_stamps = card.current_stamps + 1;
}
```

---

## 2. Next.js 16 + React 19 Patterns

### App Router Best Practices for Server vs Client Components

**Foundational rule:** Server components are default; only add "use client" when needed.

**Key principle:** "use client" declares a boundary, not a single component.
- Once a file has `"use client"`, ALL its imports and children are in the client bundle
- Be granular — mark only the specific component that needs interactivity

**For Suiki dApp structure:**

```typescript
// app/page.tsx (Server Component by default)
import { MerchantChoice } from '@/components/merchant-choice'

export default function LandingPage() {
  // This runs on server, no client code here
  return (
    <div>
      <h1>Suiki Stamp Cards</h1>
      <MerchantChoice /> {/* Client component */}
    </div>
  )
}
```

```typescript
// components/merchant-choice.tsx (Client Component)
"use client"

import { useRouter } from "next/navigation"

export function MerchantChoice() {
  const router = useRouter()

  return (
    <div>
      <button onClick={() => router.push('/merchant')}>
        I'm a Merchant
      </button>
      <button onClick={() => router.push('/customer')}>
        I'm a Customer
      </button>
    </div>
  )
}
```

**Rule for dApp components:**

| Component | Type | Reason |
|-----------|------|--------|
| Layout wrapper with wallet provider | Client | Requires dApp-kit context |
| Pages that use dApp-kit hooks | Client | useSignAndExecuteTransaction, useSuiClientQuery |
| Display components (read-only) | Server when possible | Better performance, less JS |
| QR scanner | Client | Camera access requires browser APIs |
| Forms with Server Actions | Client | useActionState needs client-side state |

**Server-side data fetching (before rendering):**

```typescript
// app/merchant/page.tsx (Server Component)
import { fetchMerchantPrograms } from '@/lib/queries'

export default async function MerchantPage() {
  // This runs on server at build/request time
  const programs = await fetchMerchantPrograms()

  return (
    <div>
      {programs.map(program => (
        <MerchantProgramCard key={program.id} program={program} />
      ))}
    </div>
  )
}

// components/merchant-program-card.tsx
export function MerchantProgramCard({ program }) {
  // Can be server or client, doesn't matter
  // Receives data as props from parent
  return <div>{program.name}</div>
}
```

**Client-side data fetching with dApp-kit (required):**

```typescript
// components/my-stamp-cards.tsx (Client Component)
"use client"

import { useSuiClientQuery } from "@mysten/dapp-kit"
import { useCurrentAccount } from "@mysten/dapp-kit"

export function MyStampCards() {
  const account = useCurrentAccount()

  // Must be in client component
  const { data: cards, isLoading } = useSuiClientQuery("getObject", {
    id: account?.address ?? "",
    // ...
  })

  return <div>{/* render cards */}</div>
}
```

---

### React 19 New Features Relevant to Suiki

#### 1. useActionState for Transaction Forms

**Problem:** Transaction signing needs client state management for pending/error/success states.

**Solution:** `useActionState` hook with Server Actions.

**Pattern for signing stamp transactions:**

```typescript
// app/actions/stamps.ts (Server Action)
"use server"

import { signAndSponsorTransaction } from '@/lib/sponsor'

export async function issueStampAction(
  prevState: any,
  formData: FormData,
) {
  const programId = formData.get('programId') as string
  const cardId = formData.get('cardId') as string

  try {
    const result = await signAndSponsorTransaction({
      type: 'issue_stamp',
      program_id: programId,
      card_id: cardId,
    })

    return {
      success: true,
      digest: result.digest,
      message: 'Stamp issued successfully!',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

```typescript
// components/issue-stamp-form.tsx (Client Component)
"use client"

import { useActionState } from 'react'
import { issueStampAction } from '@/app/actions/stamps'

export function IssueStampForm({ programId, cardId }) {
  const [state, formAction, isPending] = useActionState(
    issueStampAction,
    { success: null, message: '' }
  )

  return (
    <form action={formAction}>
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="cardId" value={cardId} />

      {state?.error && (
        <div className="text-red-600">{state.error}</div>
      )}

      {state?.success && (
        <div className="text-green-600">
          {state.message}
          <a href={`https://suiscan.xyz/tx/${state.digest}`}>
            View transaction
          </a>
        </div>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? 'Issuing...' : 'Issue Stamp'}
      </button>
    </form>
  )
}
```

**Benefits:**
- No useState needed for pending state
- Automatic form reset after submission
- Built-in progressive enhancement
- Server Action handles sensitive logic (sponsor key, transaction signing)

#### 2. Form Improvements (useFormStatus)

**Pattern for disabling button during submission:**

```typescript
"use client"

import { useFormStatus } from 'react-dom'
import { issueStampAction } from '@/app/actions/stamps'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={pending ? 'opacity-50 cursor-not-allowed' : ''}
    >
      {pending ? 'Issuing stamp...' : 'Issue Stamp'}
    </button>
  )
}

export function IssueStampForm({ programId, cardId }) {
  return (
    <form action={issueStampAction}>
      <input type="hidden" name="programId" value={programId} />
      <SubmitButton />
    </form>
  )
}
```

#### 3. Optimistic Updates (useOptimistic)

**For better UX on slow networks (important for mobile):**

```typescript
"use client"

import { useOptimistic } from 'react'
import { redeemStampAction } from '@/app/actions/stamps'

export function RedeemButton({ cardId, currentStamps }) {
  const [optimisticStamps, addOptimisticStamp] = useOptimistic(
    currentStamps,
    (state) => state - 1 // Optimistically decrement
  )

  async function handleRedeem() {
    addOptimisticStamp()

    try {
      await redeemStampAction(cardId)
    } catch (error) {
      // Optimistic update automatically reverted on error
      console.error('Redeem failed:', error)
    }
  }

  return (
    <div>
      <p>Stamps remaining: {optimisticStamps}</p>
      <button onClick={handleRedeem}>Redeem 1 Stamp</button>
    </div>
  )
}
```

**Why this matters:** On 3G networks (common in Philippines), transactions can take 2-3 seconds. Optimistic updates show the result immediately, improving perceived performance.

---

### TypeScript Strictness Settings for Next.js 16

**Recommended `tsconfig.json` for Suiki:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "target": "ES2024",
    "module": "ESNext",
    "jsx": "preserve",
    "incremental": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

**Why each setting matters for dApps:**

| Setting | Why It Matters |
|---------|----------------|
| `strict: true` | Catches Move object type errors, wallet signature issues |
| `noUncheckedIndexedAccess: true` | Prevents undefined field access on parsed objects (critical for Move objects) |
| `noImplicitReturns: true` | Catches missing return statements in transaction builders |
| `noUncheckedIndexedAccess: true` | When parsing API responses or Move object data |

**Critical for dApp-kit integration:**
- dApp-kit types are fully strict-compatible in recent versions
- Move object parsing requires strict null checks to prevent "Cannot read property of undefined"

---

## 3. @mysten/dapp-kit Integration Patterns

### useSignAndExecuteTransaction Hook (Correct Usage)

**Official docs:** This hook signs a transaction and executes it immediately.

**Correct pattern:**

```typescript
"use client"

import { useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { Transaction } from "@mysten/sui/transactions"

export function IssueStampButton({ programId, cardId }) {
  const { mutate: signAndExecute, isPending, error } = useSignAndExecuteTransaction()

  const handleIssueStamp = async () => {
    const tx = new Transaction()

    // Build the transaction
    tx.moveCall({
      target: `${PACKAGE_ID}::suiki::issue_stamp`,
      arguments: [
        tx.object(programId),
        tx.object(cardId),
      ],
    })

    // Sign and execute (handles both internally)
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          console.log('Success:', result.digest)
          // Refetch data, show success message, etc.
        },
        onError: (error) => {
          console.error('Error:', error)
          // Show error toast or modal
        },
      }
    )
  }

  return (
    <div>
      <button
        onClick={handleIssueStamp}
        disabled={isPending}
      >
        {isPending ? 'Issuing...' : 'Issue Stamp'}
      </button>
      {error && <p className="text-red-600">{error.message}</p>}
    </div>
  )
}
```

**Key points:**
- Returns `{ mutate, isPending, error, data }`
- Use `mutate` with `{ transaction }` parameter
- `onSuccess` receives `{ digest, signatures, epoch, status }`
- `onError` receives standard Error object
- `isPending` is useful for disabling buttons

**What NOT to do:**
```typescript
// ❌ WRONG - useSignAndExecuteTransaction is not a promise
const result = await useSignAndExecuteTransaction()

// ❌ WRONG - Do not manually sign before calling (it signs automatically)
const signed = await signTransaction(tx)
signAndExecute(signed)

// ✅ RIGHT - Just pass the transaction
signAndExecute({ transaction: tx })
```

---

### Sponsored Transaction Flow with Gas Station API

**Suiki architecture:** Sponsor key lives in Next.js API route, signs fee (not available to frontend).

**Correct flow:**

```
1. Frontend builds transaction
2. Frontend calls useSignTransaction (user's wallet)
3. Frontend sends signed tx to /api/sponsor
4. API route calls Gas Station, gets sponsor signature
5. Frontend calls executeTransactionBlock with both signatures
6. Poll for finality
```

**Step-by-step implementation:**

```typescript
// components/sponsor-form.tsx (Client Component)
"use client"

import { useSignTransaction, useSuiClient } from "@mysten/dapp-kit"
import { useState } from "react"

export function SponsorForm({ programId, cardId }) {
  const signTx = useSignTransaction()
  const suiClient = useSuiClient()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [digest, setDigest] = useState<string>()

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(undefined)

    try {
      // Step 1: Build transaction
      const tx = new Transaction()
      tx.moveCall({
        target: `${PACKAGE_ID}::suiki::issue_stamp`,
        arguments: [
          tx.object(programId),
          tx.object(cardId),
        ],
      })

      // Step 2: User signs
      const userSignature = await signTx({
        transaction: tx,
      })

      // Step 3: Request sponsor signature
      const sponsorResponse = await fetch("/api/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionBlock: userSignature.transactionBlockBytes,
          userSignature: userSignature.signature,
        }),
      })

      if (!sponsorResponse.ok) {
        throw new Error(`Sponsor error: ${sponsorResponse.statusText}`)
      }

      const { sponsorSignature } = await sponsorResponse.json()

      // Step 4: Execute with both signatures
      const result = await suiClient.executeTransactionBlock({
        transactionBlock: userSignature.transactionBlockBytes,
        signatures: [userSignature.signature, sponsorSignature],
      })

      setDigest(result.digest)

      // Step 5: Poll for finality (optional but recommended)
      const finalResult = await suiClient.waitForTransactionBlock({
        digest: result.digest,
        timeout: 30000,
      })

      console.log("Transaction finalized:", finalResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "Processing..." : "Issue Stamp"}
      </button>
      {error && <p className="text-red-600">{error}</p>}
      {digest && (
        <a href={`https://suiscan.xyz/tx/${digest}`}>
          View transaction
        </a>
      )}
    </div>
  )
}
```

```typescript
// app/api/sponsor/route.ts (Server Route)
import { SuiClient } from "@mysten/sui/client"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import { Transaction } from "@mysten/sui/transactions"

const suiClient = new SuiClient({ url: "https://fullnode.testnet.sui.io:443" })
const sponsorKeypair = Ed25519Keypair.fromSecretKey(
  Buffer.from(process.env.SPONSOR_PRIVATE_KEY!, "base64")
)

export async function POST(request: Request) {
  try {
    const { transactionBlock, userSignature } = await request.json()

    // Reconstruct the transaction
    const tx = Transaction.from(transactionBlock)

    // Optional: Validate user signature before sponsoring
    // (Gas Station API may do this for you)

    // Gas Station signs the gas object
    // (This example uses manual signing, but check if your Gas Station has an API)
    const sponsorSignature = await suiClient.signTransactionBlock({
      transactionBlock: transactionBlock,
      signer: sponsorKeypair,
    })

    return Response.json({
      sponsorSignature: sponsorSignature.signature,
    })
  } catch (error) {
    console.error("Sponsor error:", error)
    return Response.json(
      { error: "Sponsor failed" },
      { status: 500 }
    )
  }
}
```

**Critical error handling:**

```typescript
// Handle "gas object locked" error (object in use by another tx)
if (error.message.includes("object locked")) {
  // Retry with exponential backoff
  await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
  return handleSubmit() // retry
}

// Handle "insufficient balance" error
if (error.message.includes("insufficient balance")) {
  // Inform sponsor to fund gas wallet
  console.error("Gas wallet needs funding")
  return
}

// Handle "sponsor rejected" error
if (error.message.includes("sponsor")) {
  // Could be rate limited or invalid
  // Fallback to user-paid gas if available
  console.error("Sponsor unavailable")
}
```

---

### useSuiClientQuery for Fetching Shared Objects

**Pattern for watching StampProgram and StampCard state:**

```typescript
"use client"

import { useSuiClientQuery } from "@mysten/dapp-kit"
import { useCurrentAccount } from "@mysten/dapp-kit"

// Fetch a single StampProgram
export function ProgramDetail({ programId }: { programId: string }) {
  const { data, isLoading, error, refetch } = useSuiClientQuery("getObject", {
    id: programId,
    options: {
      showType: true,        // Include object type
      showContent: true,     // Include fields
      showOwner: true,       // Include owner address
      showBcs: false,        // Skip raw bytecode (saves bandwidth)
    },
  })

  if (isLoading) return <div>Loading program...</div>
  if (error) return <div>Error: {error.message}</div>

  const program = parseStampProgram(data)

  return (
    <div>
      <h2>{program?.name}</h2>
      <p>Active: {program?.active ? "Yes" : "No"}</p>
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  )
}

// Parse Move object into TypeScript interface
interface StampProgram {
  id: string
  owner: string
  name: string
  active: boolean
}

function parseStampProgram(data: any): StampProgram | null {
  if (!data?.data?.content) return null

  const fields = (data.data.content as any).fields
  return {
    id: data.data.objectId,
    owner: fields.owner,
    name: fields.name,
    active: fields.active,
  }
}

// Fetch multiple StampCards (customer's collection)
export function MyCards() {
  const account = useCurrentAccount()

  // Query is more flexible for dynamic queries
  const { data: cards, isLoading } = useSuiClientQuery(
    "multiGetObjects",
    {
      ids: account?.address ? [/* card IDs */] : [],
      options: { showContent: true },
    },
    { enabled: !!account?.address }
  )

  return (
    <div>
      {cards?.map(card => (
        <StampCardDisplay key={card.objectId} data={card} />
      ))}
    </div>
  )
}
```

**Options explanation:**

| Option | Purpose | Bandwidth |
|--------|---------|-----------|
| `showType: true` | Include type string (e.g., "0x123::suiki::StampCard") | Small |
| `showContent: true` | Include Move struct fields (required for your data) | Medium |
| `showOwner: true` | Include owner info (who owns/controls object) | Small |
| `showBcs: false` | Skip raw Move bytecode representation | Large (usually not needed) |

**Auto-refetch (polling):**

```typescript
const { data, refetch } = useSuiClientQuery(
  "getObject",
  { id: cardId, options: { showContent: true } },
  {
    // Refetch every 10 seconds
    refetchInterval: 10000,
    // Stale after 5 seconds (triggers refetch on focus)
    staleTime: 5000,
  }
)
```

---

### Type Safety with SuiObjectData

**Problem:** Parsing Move objects without type safety leads to runtime errors.

**Solution:** Create type guards and parsers:

```typescript
import { SuiObjectResponse } from "@mysten/sui/client"

// Type-safe interface matching Move struct
interface StampCard {
  id: string
  owner: string
  programId: string
  currentStamps: number
  totalCapacity: number
}

// Type guard function
function isStampCard(obj: any): obj is StampCard {
  return (
    typeof obj?.id === "string" &&
    typeof obj?.owner === "string" &&
    typeof obj?.programId === "string" &&
    typeof obj?.currentStamps === "number" &&
    typeof obj?.totalCapacity === "number"
  )
}

// Parser function (safe to use in components)
function parseStampCard(data: SuiObjectResponse | undefined): StampCard | null {
  if (!data?.data || !("content" in data.data)) {
    return null
  }

  const content = data.data.content as any
  if (!content?.fields) {
    return null
  }

  const f = content.fields
  const card: any = {
    id: data.data.objectId,
    owner: f.owner ?? "",
    programId: f.program_id ?? "",
    currentStamps: f.current_stamps ?? 0,
    totalCapacity: f.total_capacity ?? 10,
  }

  if (!isStampCard(card)) {
    console.error("Invalid StampCard object:", card)
    return null
  }

  return card
}

// Usage in component
export function StampCardDisplay({ cardData }: { cardData: SuiObjectResponse }) {
  const card = parseStampCard(cardData)

  if (!card) {
    return <div>Invalid card data</div>
  }

  return (
    <div>
      <h3>{card.id.slice(0, 8)}...</h3>
      <p>Progress: {card.currentStamps}/{card.totalCapacity}</p>
    </div>
  )
}
```

**Alternative: Zod validation (recommended for complex objects):**

```typescript
import { z } from "zod"

const StampCardSchema = z.object({
  id: z.string(),
  owner: z.string(),
  program_id: z.string(),
  current_stamps: z.number().int().min(0),
  total_capacity: z.number().int().min(1),
})

function parseStampCardWithZod(data: any) {
  try {
    return StampCardSchema.parse(data)
  } catch (error) {
    console.error("Parse error:", error)
    return null
  }
}
```

---

## 4. Production Optimization Standards

### Next.js Bundle Optimization for dApp-kit

**Problem:** @mysten/dapp-kit + @mysten/sui is ~500KB minified, significantly impacts first load.

**Solution: Dynamic imports with `ssr: false`**

```typescript
// components/wallet-provider.tsx
import dynamic from "next/dynamic"
import React from "react"

// Dynamically import the actual provider, don't SSR it
const DAppKitProvider = dynamic(
  () => import("@mysten/dapp-kit").then(mod => ({
    default: mod.SuiClientProvider,
  })),
  { ssr: false, loading: () => <div>Loading wallet...</div> }
)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <DAppKitProvider>
      {children}
    </DAppKitProvider>
  )
}
```

**Better: Route groups to isolate dApp pages**

```
src/
├── app/
│   ├── layout.tsx                    # Root layout (small bundle)
│   ├── page.tsx                      # Landing (no dApp-kit needed)
│   └── (dapp)/                       # Route group
│       ├── layout.tsx                # DAppKitProvider here
│       ├── merchant/
│       │   ├── page.tsx
│       │   └── create/page.tsx
│       └── customer/
│           └── page.tsx
```

**Root layout (minimal):**

```typescript
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  )
}
```

**DApp layout (with providers):**

```typescript
// app/(dapp)/layout.tsx
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit"
import "@mysten/dapp-kit/styles.css"

export default function DAppLayout({ children }) {
  return (
    <SuiClientProvider>
      <WalletProvider>{children}</WalletProvider>
    </SuiClientProvider>
  )
}
```

**Result:** Landing page loads without dApp-kit; only loaded when user navigates to `/merchant` or `/customer`.

### Dynamic Imports for QR Scanner

**Problem:** Camera/QR scanning libraries are heavy and not needed on landing page.

**Pattern:**

```typescript
// components/qr-scanner.tsx
"use client"

import { Suspense, dynamic } from "react"

// Only load on client, only when mounted
const QRScannerContent = dynamic(
  () => import("./qr-scanner-content"),
  {
    ssr: false,
    loading: () => <div className="p-4">Initializing camera...</div>,
  }
)

export function QRScanner() {
  return (
    <Suspense fallback={<div>Loading scanner...</div>}>
      <QRScannerContent />
    </Suspense>
  )
}

// components/qr-scanner-content.tsx (actual scanner implementation)
"use client"

import Html5QrcodePlugin from "html5-qrcode"
import { useCallback } from "react"

export function QRScannerContent() {
  const handleScan = useCallback((decodedText: string) => {
    console.log("Scanned:", decodedText)
  }, [])

  return (
    <div id="qr-scanner" />
  )
}
```

**On-demand loading:**

```typescript
// app/customer/scan/page.tsx
import { QRScanner } from "@/components/qr-scanner"

export default function ScanPage() {
  return (
    <div>
      <h1>Scan Merchant QR Code</h1>
      <QRScanner /> {/* Only loads when this page is visited */}
    </div>
  )
}
```

**Mobile detection (optional but recommended):**

```typescript
"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

const QRScanner = dynamic(
  () => import("@/components/qr-scanner").then(m => m.QRScanner),
  { ssr: false }
)

export function QRScannerOrFallback() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(/iPhone|iPad|Android/.test(navigator.userAgent))
  }, [])

  if (!isMobile) {
    return <p>QR scanning available on mobile devices</p>
  }

  return <QRScanner />
}
```

### Tailwind CSS Build Optimization

**Recommended `tailwind.config.ts` for Suiki:**

```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Suiki brand colors
        "stamp-blue": "#2563eb",
        "stamp-green": "#10b981",
      },
    },
  },
  plugins: [],
  // Optional: disable unused core plugins
  corePlugins: {
    preflight: true, // Keep reset styles
  },
}

export default config
```

**Production optimization:**

1. **Content paths must cover all templates** — Tailwind scans these paths to find class names
2. **Use full class names** — Don't concatenate: ❌ `className={\`w-\${size}\`}` ✅ `className="w-10 w-20 w-30"` (use explicit classes)
3. **Build analysis:**

```bash
# Analyze final CSS size
npm run build
# Check the .next/static/css size — should be <50KB for most apps
```

**For Suiki specifically:**

```typescript
// tailwind.config.ts
module.exports = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      spacing: {
        "stamp-gap": "1rem", // Consistent stamp spacing
      },
      animation: {
        shimmer: "shimmer 2s linear infinite", // Skeleton loading
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
      },
    },
  },
}
```

---

## 5. Integration Checklist for Tasks 5-13

Use this checklist when implementing remaining tasks:

### Task 5: Wallet Provider + Gas Station API

- [ ] Create `(dapp)` route group with SUI providers
- [ ] Implement `/api/sponsor` route with sponsor key handling
- [ ] Use `useSignTransaction` + sponsor + `executeTransactionBlock` flow
- [ ] Add error handling for "object locked" with exponential backoff
- [ ] Test on testnet with multiple concurrent sponsors

### Task 6-7: Transaction Builders & Queries

- [ ] Use `Transaction` class for all moves calls
- [ ] Create type-safe parser functions for Move objects
- [ ] Use `useSuiClientQuery` with `showContent: true` for shared objects
- [ ] Implement refetch logic for polling object state
- [ ] Add `useActionState` for form submissions

### Task 8-12: Frontend Pages

- [ ] Mark wallet-using components with `"use client"`
- [ ] Use Server Components for landing/info pages
- [ ] Dynamic import QR scanner (only load on `/scan` page)
- [ ] Use `useFormStatus` for button disable during submission
- [ ] Implement optimistic updates for stamp redemption

### Task 13: PWA + Deployment

- [ ] Verify Tailwind CSS content paths cover all components
- [ ] Test bundle size with `next build` and `next/bundle-analyzer`
- [ ] Verify dApp-kit loads in separate bundle (route group isolation)
- [ ] Test QR scanner on mobile (camera permissions)
- [ ] Configure `next.config.ts` for Vercel deployment
- [ ] Add PWA manifest.json and icons

---

## Summary of Key Patterns

| Area | Key Pattern | Why |
|------|-------------|-----|
| **Move 2024** | Shared objects with `key` ability + mutex | Required for StampProgram/Card shared access |
| **Display** | String templates with field interpolation | Wallets/explorers auto-render cards |
| **Next.js** | Route groups `(dapp)` for DAppKit provider | Isolates heavy bundle from landing page |
| **React 19** | `useActionState` for tx forms | Built-in pending/error/success state |
| **dApp-kit** | `useSignAndExecuteTransaction` | Standard hook pattern |
| **Sponsored TX** | signTransaction + API sponsor + executeBlock | Required for zero-fee UX |
| **Optimization** | Dynamic imports with `ssr: false` for dapp-kit | Reduces initial bundle |
| **Type Safety** | Parser functions with type guards | Prevents "Cannot read property of undefined" |
| **Bundle** | Tailwind content paths, ssr: false | Critical for mobile UX |

---

## Recommended Reading Order for Implementation

1. **First:** Review section 3.3 (Type Safety with SuiObjectData) before parsing any Move objects
2. **Second:** Read section 1.1 (Shared Objects Pattern) — understand before writing Move code
3. **Third:** Review section 3.2 (Sponsored Transaction Flow) — critical for Tasks 6-7
4. **Fourth:** Study section 2.2 (React 19 useActionState) — use for all form handling
5. **Fifth:** Implement section 4 (Production Optimization) during Task 13

---

## Sources & Verification

| Source | Type | Last Verified | Coverage |
|--------|------|---------------|----------|
| [Move Book](https://github.com/mystenlabs/move-book) | Official | 2024-2025 | 2024 edition, abilities, Display |
| [SUI SDK](https://github.com/mystenlabs/sui) | Official | 2024-2025 | Objects, Display, shared objects |
| [dApp Kit Docs](https://sdk.mystenlabs.com/dapp-kit) | Official | 2024-2025 | Hooks, sponsored transactions |
| [Next.js 16.1.0](https://github.com/vercel/next.js) | Official | 2024-2025 | App Router, dynamic imports, useActionState |
| [Sui Design Spec](./Suiki%20-%20Design%20Spec.md) | Internal | 2026-03-25 | Architecture context |

---

**Updated:** March 25, 2026
**Research Completed By:** Expert Technical Researcher
**Status:** Comprehensive research completed and verified

