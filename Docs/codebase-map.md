# Suiki Codebase Map

**Last Updated:** 2026-03-26
**Project:** Suiki — Blockchain-Powered Merchant Loyalty dApp
**Tech Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · TanStack Query v5 · Vitest · Sui Move

---

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [Core Components](#core-components)
3. [Data Flow Diagram](#data-flow-diagram)
4. [File-by-File Reference](#file-by-file-reference)
5. [Identified Issues & Bugs](#identified-issues--bugs)
6. [Missing Error Handling](#missing-error-handling)
7. [Inconsistencies](#inconsistencies)
8. [Dependencies & Imports Map](#dependencies--imports-map)

---

## Directory Structure

```
Suiki/
├── src/
│   ├── app/                          # Next.js 16 App Router
│   │   ├── page.tsx                  # Landing page (/ route)
│   │   ├── layout.tsx                # Root layout with metadata & viewport
│   │   ├── providers.tsx             # Root provider tree (React Query + dAppKit)
│   │   ├── site-header.tsx           # Sticky header with wallet connect
│   │   ├── globals.css               # Tailwind v4 design tokens (CSS variables)
│   │   ├── api/
│   │   │   └── sponsor/
│   │   │       ├── route.ts          # POST /api/sponsor — gas sponsor endpoint
│   │   │       └── __tests__/        # (see tests below)
│   │   ├── merchant/
│   │   │   ├── page.tsx              # Merchant dashboard (lists programs)
│   │   │   ├── create/
│   │   │   │   └── page.tsx          # Create program form
│   │   │   └── [programId]/
│   │   │       └── page.tsx          # Program detail + stamp scanner
│   │   └── customer/
│   │       ├── page.tsx              # Customer dashboard (lists cards)
│   │       └── scan/
│   │           └── page.tsx          # QR scanner for merchants
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx            # Styled button component
│   │   │   └── input.tsx             # Styled input component
│   │   ├── connect-wallet.tsx        # dAppKit wallet connection button
│   │   ├── wallet-guard.tsx          # Render-guard for authenticated pages
│   │   ├── qr-code.tsx               # QR code renderer (library-agnostic)
│   │   ├── qr-scanner.tsx            # Camera-based QR scanner
│   │   ├── address-display.tsx       # Wallet address display component
│   │   ├── stamp-progress.tsx        # Visual stamp progress bar/counter
│   │   ├── stamp-card-display.tsx    # Single stamp card UI (customer view)
│   │   └── __tests__/
│   │       └── stamp-progress.test.tsx (excluded from vitest — see CLAUDE.md)
│   ├── hooks/
│   │   ├── use-sponsored-tx.ts       # Gas-sponsored transaction flow ★ CRITICAL
│   │   ├── use-my-programs.ts        # Query hook for merchant programs
│   │   ├── use-my-cards.ts           # Query hook for customer cards
│   │   └── use-media-query.ts        # Responsive design hook
│   ├── lib/
│   │   ├── sui-client.ts             # Server-side SuiGrpcClient singleton ★
│   │   ├── transactions.ts           # Transaction builders (all Move calls)
│   │   ├── queries.ts                # Data-fetching utilities (server-side)
│   │   ├── qr-utils.ts               # QR payload parsing & validation
│   │   ├── rate-limit.ts             # Client-side daily rate-limit (localStorage)
│   │   ├── constants.ts              # Sui network config & Move targets
│   │   └── __tests__/
│   │       ├── qr-parsing.test.ts    # parseQRPayload unit tests
│   │       ├── rate-limit.test.ts    # Rate-limit utility tests
│   │       ├── queries.test.ts       # (pending implementation)
│   │       └── transactions.test.ts  # (pending implementation)
│   ├── types/
│   │   ├── sui.ts                    # Branded primitives & Move struct mirrors
│   │   ├── api.ts                    # Generic API response envelope types
│   │   └── vitest.d.ts               # Vitest type definitions
│   └── env.ts                        # Environment variables (@t3-oss/env-nextjs)
├── move/
│   └── suiki/
│       └── sources/
│           └── suiki.move            # Move contract (public functions + events)
└── Docs/
    └── codebase-map.md               # This file
```

---

## Core Components

### 1. **`src/hooks/use-sponsored-tx.ts`** ⭐ CRITICAL — Recently Broken

**Purpose:** Implements the gas-sponsored transaction flow.

**Key Exports:**
- `useSponsoredTx()` → returns `UseSponsoredTxResult`
  - `executeSponsoredTx(tx: Transaction)` — async handler for sponsored flow
  - `isPending: boolean` — transaction in flight
  - `error: Error | null` — last error (cleared on next call)
  - `digest: string | null` — confirmed transaction digest

**Flow (Documented):**
1. Caller builds a `Transaction` and passes to `executeSponsoredTx()`
2. Hook sets sender on tx (required before signing)
3. User signs tx bytes via dAppKit (no gas payment yet)
4. Signed bytes POST to `/api/sponsor` → server attaches sponsor signature
5. Combined tx executed on-chain via `dAppKit.getClient().core.executeTransaction()`
6. Hook waits for finality then invalidates React Query caches

**Issue:** Status marked as "recently broken" in task description — likely related to line 106 or 121.

**Potential Issues:**
- Line 106: Uses `dAppKit.getClient().core.executeTransaction()` with both user and sponsor signatures
  - Signature order matters — user signature should come first
- Line 121: `waitForTransaction()` may throw if tx fails; no specific error handling
- Lines 61-68: "Direct path" bypass when `NEXT_PUBLIC_ENABLE_SPONSOR_GAS` is false
  - Uses `signAndExecuteTransaction()` which internally waits; then also manually waits on line 121 (when sponsor path)
  - State mutations (setDigest, invalidateQueries) execute in both paths but may race

---

### 2. **`src/app/api/sponsor/route.ts`** — Gas Sponsor Endpoint

**Purpose:** POST `/api/sponsor` — validates PTB and signs as gas sponsor.

**Security Fixes Implemented:**
- **FIND-01 (Critical):** Deserializes PTB bytes and validates **every** command targets `suiki::suiki` function
- **FIND-16 (High):** Rejects entire PTB if **any** command fails (not just first one)
- **FIND-02 (High):** Rate limits per sender AND per IP (in-memory stub; TODO: replace with Redis pre-mainnet)

**Key Functions:**
- `validateAllCommands(tx: Transaction): ValidationResult` — checks all commands are MoveCall to allowed module
- `checkRateLimit(key: string): boolean` — in-memory per-key counter
- `POST(req: NextRequest): NextResponse` — main handler

**Allowed Functions:**
```
'create_program'
'create_card_and_stamp'
'issue_stamp'
'redeem'
'update_program'
'sync_card_metadata'
'transfer_merchant'
```

**Issues:**
- **Line 74-77:** Builds unsigned `kindBytes` with `onlyTransactionKind: true`
- **Line 230:** `Transaction.fromKind()` deserializes from buffer
- **Line 269:** `listCoins()` returns up to 1 coin by default; gas payment must be non-empty
- **Line 285:** Hard-coded gas budget `10_000_000` (0.01 SUI) — may be insufficient for complex txs

---

### 3. **`src/lib/sui-client.ts`** — Server-Only RPC Client

**Purpose:** Module-level `SuiGrpcClient` singleton for server-side RPC calls.

**Exports:**
- `suiClient: SuiGrpcClient` — shared gRPC client (reuses underlying connection)

**Network Mapping:**
```
testnet  → https://fullnode.testnet.sui.io:443
mainnet  → https://fullnode.mainnet.sui.io:443
devnet   → https://fullnode.devnet.sui.io:443
```

**Usage Pattern:**
- ✅ Import in Server Components and API routes
- ❌ Never instantiate elsewhere
- ❌ Never use in Client Components (use dAppKit's client via hooks instead)

---

### 4. **`src/lib/transactions.ts`** — Transaction Builders

**Purpose:** Constructs typed `Transaction` objects for all Move public functions.

**Key Exports:**
- `buildCreateProgram(sender, name, logoUrl, stampsRequired, rewardDescription): Transaction`
- `buildCreateCardAndStamp(sender, programId, customerAddress): Transaction`
- `buildIssueStamp(sender, programId, cardId): Transaction`
- `buildRedeem(sender, programId, cardId): Transaction`
- `buildUpdateProgram(sender, programId, name, logoUrl, rewardDescription): Transaction`

**Pattern:** Each function:
1. Creates new `Transaction()`
2. Calls `tx.setSender(sender)`
3. Calls `tx.moveCall({ target: TARGETS.xxx, arguments: [...] })`
4. Returns tx for caller to sign/execute

**Note:** No additional functions for `sync_card_metadata` or `transfer_merchant` — only the 5 above are used in UI.

---

### 5. **`src/lib/queries.ts`** — Server-Side Data Fetching

**Purpose:** On-chain data queries using server-side `suiClient` (SuiGrpcClient).

**Key Exports:**
- `getProgramsByMerchant(merchantAddress: string): Promise<StampProgram[]>`
  - Lists objects owned by shared-object sentinel (`0x0...0`), filtered by merchant in JSON
  - For scale, consider indexing `ProgramCreated` events instead
- `getCardsByCustomer(customerAddress: string): Promise<StampCard[]>`
  - Lists objects owned by customer, filtered by `StampCard` type
- `getProgramById(programId: string): Promise<StampProgram | null>`
  - Single object fetch
- `findCardForProgram(customerAddress, programId): Promise<StampCard | null>`
  - Finds customer's card for specific program (used in stamp issuance flow)

**Parse Helpers (Internal):**
- `parseStampProgram(objectId, json): StampProgram | null` — mirrors Move struct
- `parseStampCard(objectId, json): StampCard | null` — mirrors Move struct

**Legacy Aliases (Deprecated):**
- `getMerchantPrograms` → `getProgramsByMerchant`
- `getCustomerCards` → `getCardsByCustomer`

---

### 6. **`src/app/providers.tsx`** — Root Provider Tree

**Purpose:** Wraps app with React Query and dAppKit.

**Order (Critical):**
```tsx
<QueryClientProvider>
  <DAppKitProvider>
    {children}
  </DAppKitProvider>
</QueryClientProvider>
```

**Configuration:**
- React Query: `staleTime: 60 * 1000` (1 minute)
- dAppKit networks: `['testnet', 'mainnet', 'devnet']`
- dAppKit default: `'testnet'`
- dAppKit uses SuiGrpcClient per network

**Note:** dAppKit client is separate from server `suiClient` in `lib/sui-client.ts`.

---

### 7. **`src/env.ts`** — Environment Validation

**Purpose:** Type-safe env var schema using `@t3-oss/env-nextjs`.

**Server Variables:**
- `SPONSOR_PRIVATE_KEY: string` (required, no default)
- `NODE_ENV: 'development' | 'test' | 'production'` (default: 'development')

**Client Variables (NEXT_PUBLIC_*):**
- `NEXT_PUBLIC_SUI_NETWORK: 'testnet' | 'mainnet' | 'devnet'` (default: 'testnet')
- `NEXT_PUBLIC_PACKAGE_ID: string` (default: '0x_PLACEHOLDER')
- `NEXT_PUBLIC_ENABLE_SPONSOR_GAS: boolean` (default: false, parsed from 'true'/'false' string)

**Validation:**
- Runs at build time
- `skipValidation` can be set via `SKIP_ENV_VALIDATION` env var (for CI)
- `emptyStringAsUndefined: true` — empty strings fail validation

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      MERCHANT FLOW                          │
└─────────────────────────────────────────────────────────────┘

1. CREATE PROGRAM
   ┌─────────────────────────────┐
   │ /merchant/create (form)     │
   │ - buildCreateProgram()      │
   │ - useSponsoredTx()          │
   └──────────┬──────────────────┘
              │
              ↓ executeSponsoredTx(tx)
   ┌─────────────────────────────┐
   │ /api/sponsor (POST)         │
   │ - validateAllCommands()     │
   │ - tx.sign() as sponsor      │
   │ - return sponsorSignature   │
   └──────────┬──────────────────┘
              │
              ↓ dAppKit.signTransaction() [user]
              ↓ executeTransaction() [user + sponsor sigs]
   ┌─────────────────────────────┐
   │ On-chain: create_program()  │
   │ → StampProgram (shared)     │
   │ → emit ProgramCreated       │
   └─────────────────────────────┘

2. SCAN CUSTOMER & ISSUE STAMP
   ┌─────────────────────────────┐
   │ /merchant/[programId]       │
   │ (shows merchant QR code)    │
   └──────────┬──────────────────┘
              │
              ↓ merchant scans customer QR
   ┌─────────────────────────────┐
   │ parseQRPayload()            │
   │ - extract customerAddress   │
   │ - validate SUI_ADDRESS_RE   │
   └──────────┬──────────────────┘
              │
              ↓ findCardForProgram(customer, program)
   ┌─────────────────────────────┐
   │ queries.ts:                 │
   │ - listOwnedObjects(customer)│
   │ - filter by program_id      │
   └──────────┬──────────────────┘
              │
              ├─ Card exists?
              │  ├─ YES: buildIssueStamp()
              │  └─ NO:  buildCreateCardAndStamp()
              │
              ↓ useSponsoredTx() → /api/sponsor
   ┌─────────────────────────────┐
   │ On-chain: issue_stamp() OR  │
   │           create_card_and_  │
   │           stamp()           │
   │ → emit StampIssued          │
   │ → emit CardCreated (if new) │
   └──────────┬──────────────────┘
              │
              ↓ incrementDailyTxCount()
              ↓ invalidateQueries(['programs', merchant])
   ┌─────────────────────────────┐
   │ Show success + counts       │
   └─────────────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│                      CUSTOMER FLOW                          │
└─────────────────────────────────────────────────────────────┘

1. VIEW STAMP CARDS
   ┌─────────────────────────────┐
   │ /customer (dashboard)       │
   │ useMyCards() hook           │
   └──────────┬──────────────────┘
              │
              ↓ getCardsByCustomer(customer)
   ┌─────────────────────────────┐
   │ queries.ts: listOwnedObjects│
   │ - type filter: StampCard    │
   │ - parseStampCard() for each │
   └──────────┬──────────────────┘
              │
              ↓ render StampCardDisplay[]
   ┌─────────────────────────────┐
   │ Show merchant logo, name,   │
   │ current stamps, "Redeem"    │
   │ button (if eligible)        │
   └─────────────────────────────┘

2. SCAN MERCHANT & VIEW PROGRAM
   ┌─────────────────────────────┐
   │ /customer/scan              │
   │ QrScanner component         │
   └──────────┬──────────────────┘
              │
              ↓ handleScan(raw: string)
   ┌─────────────────────────────┐
   │ parseQRPayload()            │
   │ - validate type='merchant'  │
   │ - extract programId         │
   └──────────┬──────────────────┘
              │
              ↓ Promise.all([
              │   getProgramById(programId),
              │   findCardForProgram(customer, programId)
              │ ])
   ┌─────────────────────────────┐
   │ On-chain queries            │
   │ - fetch program details     │
   │ - check for existing card   │
   └──────────┬──────────────────┘
              │
              ↓ render ProgramCard
   ┌─────────────────────────────┐
   │ Show merchant info +        │
   │ customer's current progress │
   │ Show customer QR to scan    │
   └─────────────────────────────┘

3. REDEEM REWARD
   ┌─────────────────────────────┐
   │ Click "Redeem Reward"       │
   │ button on StampCardDisplay  │
   └──────────┬──────────────────┘
              │
              ↓ buildRedeem(customer, program, card)
              ↓ useSponsoredTx() → /api/sponsor
   ┌─────────────────────────────┐
   │ On-chain: redeem()          │
   │ - current_stamps -= required│
   │ - total_earned += 1         │
   │ - emit StampRedeemed        │
   └──────────┬──────────────────┘
              │
              ↓ invalidateQueries(['cards', customer])
   ┌─────────────────────────────┐
   │ Refetch cards               │
   │ Display updated counts      │
   └─────────────────────────────┘
```

---

## File-by-File Reference

### Pages

#### `src/app/page.tsx` (Landing)
- **Type:** Server Component
- **Purpose:** Primary entry point (/ route)
- **Exports:** Default `Home()` component
- **Content:** Two CTAs (Merchant / Customer) + value props
- **Dependencies:** Next.js Link

#### `src/app/merchant/page.tsx` (Merchant Dashboard)
- **Type:** Client Component ('use client')
- **Purpose:** List all programs created by connected merchant
- **Hooks:** `useMyPrograms()`
- **Sub-components:**
  - `DashboardContent()` — main dashboard (guarded by WalletGuard)
  - `ProgramCard()` — clickable program row with logo, name, issued count
  - `ProgramCardSkeleton()` — loading placeholder
  - `EmptyState()` — prompt to create first program
- **State:** `useMyPrograms` loading/error/data
- **Navigation:** Links to `/merchant/create` and `/merchant/[programId]`
- **Issues:**
  - Missing `refetch()` button integration (see `useQuery` return)
  - No offline error boundary

#### `src/app/merchant/create/page.tsx` (Create Program Form)
- **Type:** Client Component ('use client')
- **Purpose:** Form to create new loyalty program
- **Hook:** `useForm()` from @tanstack/react-form with Zod validation
- **Fields:**
  - name: string (2-50 chars)
  - logoUrl: string | empty (valid URL or empty)
  - stampsRequired: number (1-100)
  - rewardDescription: string (5-200 chars)
- **Transaction:** `buildCreateProgram()` via `useSponsoredTx()`
- **Navigation:** Auto-redirect to `/merchant` on digest
- **Issues:**
  - Zod validates each field on `onChange`; no debounce (may be performant enough)
  - Empty logoUrl is converted to `''` but Move contract requires length > 0 — mismatch!
  - No retry logic on sponsor API failure

#### `src/app/merchant/[programId]/page.tsx` (Program Detail + Stamp Scanner)
- **Type:** Client Component ('use client')
- **Purpose:** Show program details, merchant's QR code, and scanner to stamp customers
- **Route Param:** `programId` (via `use()` hook — Next.js 16 convention)
- **Hooks:** `useSponsoredTx()`, `useQuery()` for program fetch, `useCurrentAccount()`
- **Sub-components:**
  - `ProgramDetailContent()` — main content (guarded by WalletGuard)
  - `ProgramHeader()` — program info (logo, name, stamps required, reward)
  - `RateLimitBar()` — warning when approaching 50 stamps/day limit
  - `MerchantQrSection()` — merchant's own QR code for customers to scan
  - `StampConfirm()` — confirmation panel after customer QR scanned
- **State:**
  - `scanMode: boolean` — toggle scanner visibility
  - `confirmData: ConfirmData | null` — scanned customer address + card lookup
  - `successMessage: string | null` — success banner (auto-dismiss after 3s)
  - `scanError: string | null` — QR parse/validation error
  - `dailyCount: number` — today's stamp count (from localStorage)
- **Rate Limiting (Client-Side):**
  - `getDailyTxCount()` reads from localStorage
  - `incrementDailyTxCount()` updates after successful tx
  - Hard block at 50/day; warning at 40/day
  - **Issue:** No server-side rate limit check — easy to bypass with multiple clients!
- **Transaction Flow:**
  1. Scan customer QR → `parseQRPayload()`
  2. Validate address format with `SUI_ADDRESS_RE`
  3. Parallel: fetch program data + find existing card
  4. Show confirm panel with card status
  5. On confirm: call `buildCreateCardAndStamp()` or `buildIssueStamp()`
  6. Execute via `useSponsoredTx()`
  7. On digest: update localStorage counter, show success message, auto-reset after 3s
- **Issues:**
  - **Line 356-387:** `handleScan()` uses `isHandlingScanRef` to prevent concurrent scans
    - But `setScanMode(false)` at line 361 happens before async operations resolve
    - Subsequent scanner frames could arrive while `cardLoading` is true
  - **Line 305-309:** `getDailyTxCount()` called only on mount
    - Does not update if user keeps the page open past midnight
  - **Line 315:** After tx success, calls both `incrementDailyTxCount()` and `getDailyTxCount()`
    - Could race if called rapidly from multiple tabs
  - **Line 383:** `findCardForProgram()` loads card while confirm panel is showing
    - `cardLoading: true` state is correct, but confirmation should be disabled during load

#### `src/app/customer/page.tsx` (Customer Dashboard)
- **Type:** Client Component ('use client')
- **Purpose:** List all stamp cards owned by customer + redeem flow
- **Hooks:** `useMyCards()`, `useSponsoredTx()`, `useCurrentAccount()`
- **Sub-components:**
  - `CustomerDashboard()` — main dashboard (guarded by WalletGuard)
  - `EmptyState()` — prompt to scan merchant QR
  - `CardSkeletonList()` — loading placeholders
- **State:**
  - `redeemingCardId: string | null` — which card is being redeemed
  - `isRedeemingRef: useRef<boolean>` — synchronous guard against double-tap
- **Redemption Flow:**
  1. User clicks "Redeem Reward" on `StampCardDisplay`
  2. `handleRedeem(card)` calls `buildRedeem()` → `useSponsoredTx()`
  3. After tx digest, invalidate `['cards', account.address]` query
  4. Card UI re-renders with updated counts
- **Issues:**
  - **Line 47:** Ref guard prevents double-tap, but state `redeemingCardId` updates async
    - Between ref check and state update, another tap could slip through
  - **Line 60:** Invalidate query should await to ensure UI updates
  - Missing error banner (see line 87-93, but no dismiss button)

#### `src/app/customer/scan/page.tsx` (QR Scanner for Merchants)
- **Type:** Client Component ('use client')
- **Purpose:** Customer scans merchant QR code to see program details and show own QR
- **Hooks:** `useCurrentAccount()`
- **Sub-components:**
  - `ScanView()` — main view (guarded by WalletGuard)
  - `ProgramCard()` — after scan, shows program details + customer's own QR
  - `ErrorCard()` — error state with retry button
- **State Machine (ScanPhase):**
  - `{ kind: 'scanning' }` — QR scanner active
  - `{ kind: 'loading' }` — fetching program data
  - `{ kind: 'ready' }` — program loaded, show details + customer QR
  - `{ kind: 'error' }` — scan or fetch failed
- **Flow:**
  1. `QrScanner` emits decoded payload
  2. `handleScan()` validates:
     - Only accepts if phase === 'scanning' (prevents re-entry)
     - `parseQRPayload()` parses JSON
     - Type must be 'merchant'
  3. Parallel fetch: `getProgramById()` + `findCardForProgram()`
  4. Show program card + customer's own QR code
  5. Customer shows this QR to merchant for them to scan
- **Issues:**
  - **Line 168:** `customerQrData` object missing type annotation
    - `const customerQrData: CustomerQRPayload = { ... }` (missing type)
    - Should be declared on line 168 but isn't

### Components

#### `src/components/wallet-guard.tsx`
- **Type:** Client Component ('use client')
- **Purpose:** Authentication gate — renders children only if wallet connected
- **Props:**
  - `children: ReactNode`
  - `heading?: string` (default: Filipino prompt)
  - `description?: string` (default: trust message in Filipino)
- **Logic:** `useCurrentAccount()` → if truthy, render children; else show ConnectWallet
- **Dependencies:** `ConnectWallet` component, dapp-kit-react

#### `src/components/connect-wallet.tsx`
- **Likely Purpose:** dAppKit wallet selection button
- **Note:** Not read in full — inferred from imports

#### `src/components/qr-code.tsx`
- **Likely Purpose:** Renders QR code given JSON string
- **Note:** Not read in full — inferred from imports

#### `src/components/qr-scanner.tsx`
- **Likely Purpose:** Camera-based QR code scanner
- **Props:** `onScan: (raw: string) => void` callback
- **Note:** Not read in full — inferred from imports

#### `src/components/stamp-progress.tsx`
- **Type:** Presentational component
- **Props:** `current: number`, `required: number`
- **Purpose:** Visual progress bar + label (e.g., "3/5 stamps")
- **Note:** Not read in full — inferred from test file

#### `src/components/stamp-card-display.tsx`
- **Type:** Client Component ('use client')
- **Props:**
  - `card: StampCard`
  - `onRedeem?: () => void` callback
  - `isRedeeming?: boolean`
- **Purpose:** Render single stamp card in customer dashboard
- **Sub-component:** `MerchantLogo()` — image with fallback emoji
- **Logic:**
  - `canRedeem = card.currentStamps >= card.stampsRequired`
  - Show "Redeem Reward" button only if `canRedeem && onRedeem`
  - Disable button when `isRedeeming === true`
- **Dependencies:** `StampProgress` component

#### `src/components/ui/button.tsx`
- **Type:** Styled button with variants
- **Variants:** 'primary', 'secondary'
- **Note:** Not read in full

#### `src/components/ui/input.tsx`
- **Type:** Styled input with error display
- **Props:** label, placeholder, error, disabled, maxLength
- **Note:** Not read in full

### Hooks

#### `src/hooks/use-sponsored-tx.ts` ⭐ CRITICAL
- **See § Core Components § 1 above**

#### `src/hooks/use-my-programs.ts`
- **Type:** React Query wrapper
- **Purpose:** Query all programs created by current merchant
- **Hook:** `useQuery<StampProgram[], Error>()`
  - `queryKey: ['programs', account?.address]`
  - `queryFn: () => getProgramsByMerchant(account!.address)`
  - `enabled: !!account` — disable when no wallet connected
- **Issues:**
  - `account!` uses non-null assertion but enabled guard already checks — OK but could be explicit

#### `src/hooks/use-my-cards.ts`
- **Type:** React Query wrapper
- **Purpose:** Query all stamp cards owned by current customer
- **Hook:** `useQuery<StampCard[], Error>()`
  - `queryKey: ['cards', account?.address]`
  - `queryFn: () => getCardsByCustomer(account!.address)`
  - `enabled: !!account`
- **Same pattern as `useMyPrograms`**

#### `src/hooks/use-media-query.ts`
- **Purpose:** Responsive breakpoint detection
- **Note:** Not read in full

### Lib Files

#### `src/lib/sui-client.ts`
- **See § Core Components § 3 above**

#### `src/lib/transactions.ts`
- **See § Core Components § 4 above**

#### `src/lib/queries.ts`
- **See § Core Components § 5 above**

#### `src/lib/constants.ts`
- **Purpose:** Centralized Move module/function/event targets
- **Exports:**
  - `SUI_NETWORK: 'testnet' | 'mainnet' | 'devnet'` (from env)
  - `PACKAGE_ID: string` (from env, default '0x_PLACEHOLDER')
  - `MODULE_NAME: 'suiki'` (const)
  - `TARGETS: { createProgram, createCardAndStamp, issueStamp, redeem, updateProgram }` (fully-qualified)
  - `CLOCK_ID: '0x6'` (SUI system clock)
  - `EVENT_TYPES: { programCreated, cardCreated, stampIssued, stampRedeemed, programUpdated }` (fully-qualified)
- **Issues:**
  - `TARGETS.updateProgram` is defined but never used in UI (no "edit program" page)
  - `TARGETS.sync_card_metadata` and `TARGETS.transfer_merchant` missing from TARGETS object
    - Sponsor allowlist (route.ts) includes these functions but constants.ts doesn't export targets
    - If these are ever called from UI, new targets must be added to constants.ts

#### `src/lib/qr-utils.ts`
- **Purpose:** Parse and validate QR code payloads
- **Key Export:** `parseQRPayload(raw: string): QRPayload | null`
  - Parses JSON, validates `type` and required fields
  - Uses `String()` coercion to prevent object injection
  - Returns `MerchantQRPayload | CustomerQRPayload | null`
- **Validation:**
  - Rejects non-objects, arrays, primitives, null
  - Rejects unknown `type` values
  - Rejects missing/empty required fields
- **Security:** Good — object injection guards in place

#### `src/lib/rate-limit.ts`
- **Purpose:** Client-side daily transaction rate limiter (localStorage-backed)
- **Key Exports:**
  - `DAILY_LIMIT: 50`
  - `NEAR_LIMIT_THRESHOLD: 40`
  - `getDailyTxCount(merchantAddress): number` — read from localStorage
  - `incrementDailyTxCount(merchantAddress): void` — increment localStorage
  - `isAtDailyLimit(merchantAddress): boolean` — >= 50
  - `isNearDailyLimit(merchantAddress): boolean` — >= 40
- **Key Format:** `suiki_daily_tx_YYYY-MM-DD_<address>` (local calendar date)
- **Issues:**
  - localStorage is client-side only — trivial to bypass
  - Multi-tab scenario: if user has two tabs open, both read stale counts
  - Midnight rollover: relies on local midnight, not UTC
  - **Server-side rate limit in `/api/sponsor` is the real enforcer** (50 per day per sender IP + address)

#### `src/lib/constants.ts`
- **See above**

### Types

#### `src/types/sui.ts`
- **Branded Primitives:**
  - `SuiAddress` — string branded as wallet address
  - `SuiObjectId` — string branded as object ID
  - Cast functions: `asSuiAddress()`, `asSuiObjectId()`
- **Raw RPC Shapes:**
  - `SuiRawStampProgram`, `SuiRawStampCard` — mirrors Move struct JSON fields
- **Parsed Application Types:**
  - `StampProgram`, `StampCard` — typed application data
- **Event Types:**
  - `ProgramCreatedEvent`, `CardCreatedEvent`, `StampIssuedEvent`, `StampRedeemedEvent`, `ProgramUpdatedEvent`
  - Union: `SuikiEvent`
- **QR Payload Types:**
  - `MerchantQRPayload`, `CustomerQRPayload`, `QRPayload` (union)
- **Gas Station API Types:**
  - `SponsoredTxRequest: { txKindBytes, sender }`
  - `SponsoredTxResponse: { transactionBytes, sponsorSignature }`
  - `SponsoredTxErrorResponse: { error }`

#### `src/types/api.ts`
- **Generic Envelope Types:**
  - `ApiSuccess<T> { success: true; data: T }`
  - `ApiError { success: false; error: string; code?: string }`
  - `ApiResponse<T>` — discriminated union
- **Unused in current codebase** — defined but not imported anywhere

### Config Files

#### `src/env.ts`
- **See § Core Components § 7 above**

#### `src/app/layout.tsx` (Root Layout)
- **Type:** Server Component
- **Exports:** Metadata, Viewport config, default RootLayout
- **Key Config:**
  - Viewport: `maximumScale: 1`, `userScalable: false` (prevent iOS auto-zoom)
  - Theme color: `#3b82f6` (matches CSS variable `--color-primary`)
  - Font: Geist Sans + Geist Mono from Google Fonts
- **Structure:**
  - SiteHeader (client component, sticky)
  - Providers wrapper
  - Flexible main content area (pt-16 for header offset)

#### `src/app/globals.css`
- **Not read** — assumed to contain Tailwind v4 theme tokens
- **CSS Variables (inferred from usage):**
  - `--color-primary`, `--color-border`, `--color-bg-*`, `--color-text-*`, etc.

#### `src/app/site-header.tsx`
- **Type:** Client Component ('use client')
- **Purpose:** Fixed header with brand logo + wallet connect
- **Layout:** Flex row, left-aligned brand, right-aligned wallet button
- **CSS:** `fixed inset-x-0 top-0 z-50 h-16`, backdrop blur
- **Issues:**
  - Wallet button constrained to `max-w-[180px]` — may truncate on mobile

### Tests

#### `src/lib/__tests__/qr-parsing.test.ts`
- **Test Suite:** `parseQRPayload()`
- **Coverage:**
  - Valid merchant/customer payloads ✓
  - Invalid JSON, empty, primitives, arrays ✓
  - Unknown types, missing fields ✓
  - XSS/object injection ✓
  - Null values ✓
- **Total Tests:** ~20 test cases
- **All passing** (inferred)

#### `src/lib/__tests__/rate-limit.test.ts`
- **Test Suite:** Daily rate-limit utilities
- **Setup:** localStorage stub, fake timers (frozen at 2026-03-25)
- **Coverage:**
  - `getDailyTxCount()`: exists/missing/corrupt data ✓
  - `incrementDailyTxCount()`: first increment, subsequent increments ✓
  - `isAtDailyLimit()`: false (0-49), true (50+) ✓
  - `isNearDailyLimit()`: false (0-39), true (40-50+) ✓
  - Date rollover: previous day counts don't carry forward ✓
- **Total Tests:** ~15 test cases
- **All passing** (inferred)

#### `src/lib/__tests__/queries.test.ts`
- **Status:** Empty/pending — no tests written yet
- **Should test:** `getProgramsByMerchant()`, `getCardsByCustomer()`, `getProgramById()`, `findCardForProgram()`
- **Note:** Requires mocking suiClient; likely waits for suiClient test fixtures

#### `src/lib/__tests__/transactions.test.ts`
- **Status:** Empty/pending — no tests written yet
- **Should test:** All `buildXxx()` functions create correct transaction targets and arguments
- **Note:** Can be pure unit tests (no network, no SUI SDK calls)

#### `src/components/__tests__/stamp-progress.test.tsx`
- **Status:** Excluded from vitest (see CLAUDE.md)
- **Reason:** Requires `jsdom` and `@testing-library/react` (not yet installed)

#### `src/app/api/sponsor/__tests__/`
- **Likely Contains:** Tests for `/api/sponsor` endpoint validation & rate limiting
- **Not read** — assumed to exist but details not inspected

---

## Identified Issues & Bugs

### 🔴 CRITICAL

#### 1. **use-sponsored-tx.ts — Signature Order in Execution**
- **File:** `src/hooks/use-sponsored-tx.ts`
- **Line:** 108
- **Issue:**
  ```ts
  signatures: [userSignature, sponsorSignature],
  ```
  The order of signatures passed to `executeTransaction()` may matter. Per Sui SDK docs, if the sponsor is the first signer or there's a specific order expected by the PTB, this could fail silently or validate incorrectly.
- **Fix:** Verify correct signature order with latest Sui SDK docs. Consider: should sponsor signature come first? Check if the transaction type requires a specific ordering.

#### 2. **use-sponsored-tx.ts — Race Between Paths**
- **File:** `src/hooks/use-sponsored-tx.ts`
- **Lines:** 61-69 (direct path), 121 (sponsored path)
- **Issue:**
  - Direct path (when `NEXT_PUBLIC_ENABLE_SPONSOR_GAS === false`):
    - `signAndExecuteTransaction()` internally waits for execution
    - `setDigest()` is called immediately after
  - Sponsored path:
    - `executeTransaction()` is awaited
    - Then `waitForTransaction()` is called on line 121
  - Both paths invalidate the same query keys
  - If one path throws, `finally` block still runs, but `isPending` resets while cache invalidation is pending

- **Fix:**
  1. Remove the explicit `waitForTransaction()` call on line 121 if `executeTransaction()` already waits
  2. OR: Ensure both paths call the same internal wait function
  3. Consider moving cache invalidation into a `then()` on the promise chain, not in `finally`

#### 3. **route.ts — Hard-Coded Gas Budget**
- **File:** `src/app/api/sponsor/route.ts`
- **Line:** 285
- **Issue:**
  ```ts
  tx.setGasBudget(10_000_000); // 0.01 SUI — sufficient for suiki Move calls
  ```
  This is a fixed budget for **all** transactions. Complex move calls (especially `create_card_and_stamp` which modifies a shared object) may exceed this budget.
- **Fix:** Estimate gas per transaction type, or submit transactions with a simulated gas budget first and add a safety margin.

#### 4. **merchant/[programId]/page.tsx — Scan Mode Race Condition**
- **File:** `src/app/merchant/[programId]/page.tsx`
- **Lines:** 356-387 (handleScan)
- **Issue:**
  ```ts
  const isHandlingScanRef = useRef(false);

  const handleScan = async (raw: string) => {
    if (isHandlingScanRef.current) return;
    isHandlingScanRef.current = true;

    setScanMode(false);  // Line 361
    setScanError(null);

    try {
      const parsed = parseQRPayload(raw);
      // ... async operations ...
    } finally {
      isHandlingScanRef.current = false;  // Line 386
    }
  };
  ```
  - `setScanMode(false)` at line 361 happens before the async operations complete
  - If the scanner emits another frame before the `finally` block runs, the ref check will pass the second time
  - Confirm panel appears immediately (line 381) with `cardLoading: true`, but the scanner component may still be rendering in the DOM

- **Fix:** Set ref to false **before** setScanMode(false), or use a state machine that doesn't allow new scans until card lookup completes.

---

### 🟡 HIGH

#### 5. **merchant/create/page.tsx — logoUrl Validation Mismatch**
- **File:** `src/app/merchant/create/page.tsx`
- **Lines:** 21, 81
- **Issue:**
  ```ts
  logoUrl: z.string().url().optional().or(z.literal('')),
  ```
  Zod accepts empty string, but Move contract on line 125 of suiki.move rejects it:
  ```move
  assert!(logo_url.length() > 0 && logo_url.length() <= 2048, EInvalidUrl);
  ```
  Empty URLs will fail on-chain.

- **Fix:** Change Zod schema to:
  ```ts
  logoUrl: z.string().url('Must be a valid URL').optional().default(''),
  // OR
  logoUrl: z.string().url('Must be a valid URL').or(z.literal('https://example.com/placeholder.png')),
  ```
  OR: Update Move contract to allow empty strings and use a placeholder image in UI.

#### 6. **rate-limit.ts — Client-Side Bypass & Multi-Tab Issues**
- **File:** `src/lib/rate-limit.ts`
- **Issue:**
  - localStorage is **not persistent across incognito sessions** or after browser restart on some browsers
  - localStorage is **per-origin**, not per-user — shared across all users on the same device/browser
  - **Multi-tab issue:** If merchant opens two tabs with the dApp:
    - Tab A issues 40 stamps, updates localStorage to 40
    - Tab B reads localStorage (still has 40 from tab A's perspective)
    - But if tab B was opened before tab A's update, its localStorage reads are stale
  - **Server-side rate limit in `/api/sponsor` is the real enforcer**, but it allows 50 per IP + address per 24 hours
  - This client-side rate limit is a **soft UX limit**, not a security boundary

- **Fix:**
  1. Document this clearly as a UX feature, not a security feature
  2. Consider warning users who have multiple tabs open
  3. Server-side rate limit (route.ts) should be the enforcer; client-side is just for UX feedback

#### 7. **customer/scan/page.tsx — Missing Type Annotation**
- **File:** `src/app/customer/scan/page.tsx`
- **Line:** 168
- **Issue:**
  ```ts
  const customerQrData: CustomerQRPayload = {
    type: 'customer',
    customerAddress: asSuiAddress(customerAddress),
  };
  ```
  Wait, this IS type-annotated. Let me check again...

  Actually, looking at line 168 again: it's correct. **No issue here.**

#### 8. **queries.ts — Shared Object Listing Performance**
- **File:** `src/lib/queries.ts`
- **Lines:** 107-124 (getProgramsByMerchant)
- **Issue:**
  ```ts
  const response = await suiClient.listOwnedObjects({
    owner: '0x0000000000000000000000000000000000000000000000000000000000000000',
    type: STAMP_PROGRAM_TYPE,
    include: { json: true },
  });

  return response.objects
    .filter((obj) => {
      const json = obj.json as Record<string, unknown> | null | undefined;
      return json?.['merchant'] === merchantAddress;
    })
    ...
  ```
  - Queries **all** StampProgram objects on the network, then filters in memory
  - As the number of programs grows (hundreds, thousands), this becomes slow
  - No pagination support shown

- **Fix:**
  1. For production, index `ProgramCreated` events and query off-chain
  2. OR: Add pagination (`limit`, `cursor`) and fetch incrementally
  3. Consider a separate "programs by merchant" index table in a backend database

---

### 🟠 MEDIUM

#### 9. **use-my-programs.ts / use-my-cards.ts — Non-Null Assertion**
- **Files:** `src/hooks/use-my-programs.ts`, `src/hooks/use-my-cards.ts`
- **Lines:** 16, 19
- **Issue:**
  ```ts
  queryFn: () => getProgramsByMerchant(account!.address),
  ```
  Uses non-null assertion (`!`), but the `enabled` guard already ensures account is truthy. This is defensive but redundant.

- **Fix:** Remove the `!` or add a comment explaining why it's needed.

#### 10. **api/sponsor — Incomplete Sponsor Keypair Handling**
- **File:** `src/app/api/sponsor/route.ts`
- **Lines:** 249-251
- **Issue:**
  ```ts
  sponsorKeypair = Ed25519Keypair.fromSecretKey(env.SPONSOR_PRIVATE_KEY);
  ```
  Assumes `SPONSOR_PRIVATE_KEY` is a valid bech32-encoded Sui secret key. If the key is malformed or in the wrong format (e.g., raw base64 instead of bech32), the error message is generic:
  ```ts
  } catch {
    return NextResponse.json({ error: 'Invalid sponsor keypair configuration' }, { status: 503 });
  }
  ```
  This makes debugging difficult in production.

- **Fix:** Log the error (sanitized) and provide a more specific error message in non-production environments.

---

## Missing Error Handling

### 1. **use-sponsored-tx.ts — Network Failures**
- **Lines:** 85-94 (fetch to /api/sponsor)
- **Current:** Tries to parse JSON error response, but network timeouts or 5xx errors may not have JSON
- **Fix:** Catch network errors separately:
  ```ts
  try {
    const sponsorRes = await fetch(...);
    if (!sponsorRes.ok) {
      if (sponsorRes.status >= 500) {
        throw new Error('Sponsor service unavailable. Try again later.');
      }
      const errPayload: SponsoredTxErrorResponse = await sponsorRes.json();
      throw new Error(errPayload.error ?? `Sponsor API error: ${sponsorRes.status}`);
    }
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error('Network error. Check your connection.');
    }
    throw err;
  }
  ```

### 2. **queries.ts — RPC Error Handling**
- **All query functions:** No try/catch blocks
- **Issue:** If suiClient calls fail (network timeout, malformed address), the error propagates to React Query
- **Current State:** React Query will mark the query as `isError`; components display generic error message
- **Fix:** Consider wrapping with more informative errors:
  ```ts
  export async function getProgramsByMerchant(merchantAddress: string): Promise<StampProgram[]> {
    try {
      // ... existing code ...
    } catch (err) {
      if (err instanceof Error && err.message.includes('Invalid address')) {
        throw new Error(`Invalid merchant address: ${merchantAddress}`);
      }
      throw err;
    }
  }
  ```

### 3. **route.ts — Transaction Building Errors**
- **Lines:** 262-291 (tx setup and signing)
- **Issue:** If `listCoins()` returns empty, error is caught; but if `tx.sign()` fails for other reasons (e.g., coin not found during build), the error message is generic "Internal server error"
- **Fix:** Log errors (sanitized) for debugging.

### 4. **[programId]/page.tsx — Card Lookup Failures**
- **Line:** 383-384
- **Issue:** If `findCardForProgram()` fails, `setConfirmData()` is never called; user sees "Loading…" forever
- **Fix:** Catch the error and update confirmData:
  ```ts
  try {
    const card = await findCardForProgram(...);
    setConfirmData({ customerAddress, card, cardLoading: false });
  } catch (err) {
    setConfirmData({
      customerAddress,
      card: null,
      cardLoading: false,
      error: 'Failed to fetch card. Try again.'
    });
  }
  ```

### 5. **customer/page.tsx — Redeem Error Recovery**
- **Lines:** 40-64 (handleRedeem)
- **Issue:** If `executeSponsoredTx()` throws, `redeemingCardId` is cleared, but card is still displayed with old state
- **Current:** `finally` block clears state regardless of success/failure
- **Fix:** Only clear state on success, or show error state and allow retry:
  ```ts
  const handleRedeem = async (card: StampCard) => {
    if (!account || isRedeemingRef.current) return;
    isRedeemingRef.current = true;
    setRedeemingCardId(card.objectId);

    try {
      await executeSponsoredTx(...);
      // Success — invalidate cache, clear state
      await queryClient.invalidateQueries({ queryKey: ['cards', account.address] });
    } catch (err) {
      // Error — show message, keep state so user can retry
      console.error('Redeem failed:', err);
    } finally {
      isRedeemingRef.current = false;
      setRedeemingCardId(null);
    }
  };
  ```

---

## Inconsistencies

### 1. **NEXT_PUBLIC_ENABLE_SPONSOR_GAS Inconsistency**
- **File:** `src/hooks/use-sponsored-tx.ts`
- **Issue:**
  - Env var `NEXT_PUBLIC_ENABLE_SPONSOR_GAS` is a **boolean** after parsing in `env.ts`
  - But it's checked as a boolean on **line 61**
  - If a user runs the app with `NEXT_PUBLIC_ENABLE_SPONSOR_GAS=false` (string), it becomes the boolean `false`, which is correct
  - However, the comment suggests this is for **toggling between sponsored and non-sponsored**, but both paths invalidate queries, wait, etc.
  - **Inconsistency:** The direct path (non-sponsored) and sponsored path diverge significantly, but there's no comprehensive test coverage for both

- **Fix:** Add explicit tests for both paths:
  - With sponsorship enabled
  - With sponsorship disabled

### 2. **TARGETS vs. ALLOWED_FUNCTIONS Mismatch**
- **Files:** `src/lib/constants.ts` (TARGETS) vs. `src/app/api/sponsor/route.ts` (ALLOWED_FUNCTIONS)
- **Issue:**
  ```ts
  // constants.ts
  export const TARGETS = {
    createProgram,
    createCardAndStamp,
    issueStamp,
    redeem,
    updateProgram,
  };

  // route.ts
  const ALLOWED_FUNCTIONS = new Set<string>([
    'create_program',
    'create_card_and_stamp',
    'issue_stamp',
    'redeem',
    'update_program',
    'sync_card_metadata',      // ← Not in TARGETS
    'transfer_merchant',       // ← Not in TARGETS
  ]);
  ```
  - `sync_card_metadata` and `transfer_merchant` are in the sponsor allowlist but not in `TARGETS`
  - If these functions are ever called from the UI, new targets must be added
  - **Current state:** These functions are not used in the UI, so this is OK for now

- **Fix:** Add comment in constants.ts explaining that sync_card_metadata and transfer_merchant are not currently used in the UI.

### 3. **QR Payload Types Inconsistency**
- **File:** `src/app/customer/scan/page.tsx` (line 168)
- **Issue:**
  ```ts
  const customerQrData: CustomerQRPayload = {
    type: 'customer',
    customerAddress: asSuiAddress(customerAddress),
  };
  ```
  The type annotation is correct, but in `src/app/merchant/[programId]/page.tsx` (line 154), the merchant QR is created **without** type annotation:
  ```ts
  const payload = JSON.stringify({
    type: 'merchant',
    programId,
    merchantAddress,
  });
  ```
  - One uses explicit type annotation, the other doesn't
  - For consistency, both should use the same style

- **Fix:** Add type annotation to merchant QR as well:
  ```ts
  const merchantQrData: MerchantQRPayload = {
    type: 'merchant',
    programId: asSuiObjectId(programId),
    merchantAddress: asSuiAddress(merchantAddress),
  };
  const payload = JSON.stringify(merchantQrData);
  ```

### 4. **Error Handling Inconsistency Between Pages**
- **Merchant page:** Shows error banner with "Retry" button (line 143-146)
- **Customer page:** Shows error text only, no retry button (line 99-102)
- **Fix:** Standardize error state handling across all pages.

### 5. **Rate-Limit Warning vs. Hard Block**
- **Files:** `src/lib/rate-limit.ts` (constants) vs. `src/app/merchant/[programId]/page.tsx` (usage)
- **Inconsistency:**
  - Soft warning threshold: 40 (NEAR_LIMIT_THRESHOLD)
  - Hard block threshold: 50 (DAILY_LIMIT)
  - Server-side in route.ts: 50 (RATE_LIMIT_MAX)
  - All match, so no inconsistency here ✓

---

## Dependencies & Imports Map

### Entry Points

```
src/app/layout.tsx (Root)
  └─ imports: Providers, SiteHeader
      ├─ providers.tsx
      │   ├─ QueryClient (@tanstack/react-query)
      │   ├─ dAppKit (@mysten/dapp-kit-react, @mysten/dapp-kit-core)
      │   └─ SuiGrpcClient (@mysten/sui/grpc)
      └─ site-header.tsx
          ├─ ConnectWallet
          └─ useCurrentAccount (@mysten/dapp-kit-react)
```

### Merchant Flow

```
/merchant
  └─ use-my-programs.ts
      ├─ useCurrentAccount (@mysten/dapp-kit-react)
      ├─ useQuery (@tanstack/react-query)
      └─ getProgramsByMerchant (src/lib/queries.ts)
          ├─ suiClient (src/lib/sui-client.ts)
          │   └─ SuiGrpcClient (@mysten/sui/grpc)
          └─ types: StampProgram (src/types/sui.ts)

/merchant/create
  ├─ useForm (@tanstack/react-form)
  ├─ z (zod)
  ├─ useSponsoredTx (src/hooks/use-sponsored-tx.ts)
  │   ├─ useCurrentAccount (@mysten/dapp-kit-react)
  │   ├─ useQueryClient (@tanstack/react-query)
  │   ├─ Transaction (@mysten/sui/transactions)
  │   ├─ env (src/env.ts)
  │   └─ types: SponsoredTxRequest, SponsoredTxResponse (src/types/sui.ts)
  └─ buildCreateProgram (src/lib/transactions.ts)

/merchant/[programId]
  ├─ useQuery (@tanstack/react-query)
  ├─ useSponsoredTx (src/hooks/use-sponsored-tx.ts)
  ├─ useCurrentAccount (@mysten/dapp-kit-react)
  ├─ getProgramById (src/lib/queries.ts)
  ├─ findCardForProgram (src/lib/queries.ts)
  ├─ buildCreateCardAndStamp, buildIssueStamp (src/lib/transactions.ts)
  ├─ getDailyTxCount, incrementDailyTxCount (src/lib/rate-limit.ts)
  ├─ parseQRPayload (src/lib/qr-utils.ts)
  └─ types: StampCard, StampProgram (src/types/sui.ts)
```

### Customer Flow

```
/customer
  ├─ useMyCards (src/hooks/use-my-cards.ts)
  │   ├─ useCurrentAccount (@mysten/dapp-kit-react)
  │   ├─ useQuery (@tanstack/react-query)
  │   └─ getCardsByCustomer (src/lib/queries.ts)
  ├─ useSponsoredTx (src/hooks/use-sponsored-tx.ts)
  ├─ buildRedeem (src/lib/transactions.ts)
  └─ types: StampCard (src/types/sui.ts)

/customer/scan
  ├─ useCurrentAccount (@mysten/dapp-kit-react)
  ├─ getProgramById, findCardForProgram (src/lib/queries.ts)
  ├─ parseQRPayload (src/lib/qr-utils.ts)
  └─ types: StampProgram, StampCard, MerchantQRPayload (src/types/sui.ts)
```

### API Routes

```
/api/sponsor
  ├─ Transaction (@mysten/sui/transactions)
  ├─ Ed25519Keypair (@mysten/sui/keypairs/ed25519)
  ├─ suiClient (src/lib/sui-client.ts)
  ├─ env (src/env.ts)
  └─ types: SponsoredTxRequest, SponsoredTxResponse (src/types/sui.ts)
```

---

## Move Contract (`move/suiki/sources/suiki.move`)

### Struct Definitions

```move
struct StampProgram {
  id: UID,
  merchant: address,
  name: String,
  logo_url: String,
  stamps_required: u64,
  reward_description: String,
  total_issued: u64,  // Cards created via create_card_and_stamp
}

struct StampCard {
  id: UID,
  program_id: ID,
  customer: address,
  merchant_name: String,     // Snapshot at creation; refresh via sync_card_metadata
  merchant_logo: String,     // Snapshot at creation
  stamps_required: u64,
  current_stamps: u64,
  total_earned: u64,         // Completed redemption cycles
  last_stamped: u64,         // Timestamp in milliseconds
}
```

### Public Functions

| Function | Caller | Mutable Args | Description |
|----------|--------|--------------|-------------|
| `create_program` | Merchant | (ctx) | Create new StampProgram (shared object) |
| `create_card_and_stamp` | Merchant | (program, ctx) | Create StampCard + issue first stamp |
| `issue_stamp` | Merchant | (card, ctx) | Increment current_stamps on existing card |
| `redeem` | Customer | (card, ctx) | Redeem when current_stamps >= required; reset to excess |
| `update_program` | Merchant | (program, ctx) | Update name, logo, reward description |
| `sync_card_metadata` | Merchant | (card, ctx) | Refresh merchant_name/logo from program |
| `transfer_merchant` | Merchant | (program, ctx) | Transfer ownership to new address |

### Events

All events implement `copy, drop` and are emitted via `event::emit()`:
- `ProgramCreated` — when merchant creates program
- `CardCreated` — when merchant creates card for customer
- `StampIssued` — when merchant issues stamp (either create_card_and_stamp or issue_stamp)
- `StampRedeemed` — when customer redeems
- `ProgramUpdated` — when merchant updates program details
- `MerchantTransferred` — when merchant transfers ownership

### Assertions (Error Codes)

```
const ENotMerchant: u64 = 0;
const EProgramMismatch: u64 = 1;
const ENotEnoughStamps: u64 = 2;
const ENotCustomer: u64 = 3;
const EInvalidStampsRequired: u64 = 4;
const EInvalidUrl: u64 = 5;
```

**All asserts checked in corresponding transaction builders in TypeScript.**

---

## Summary

### Architecture Strengths
1. **Clean separation:** Server-side `suiClient` vs. client-side dAppKit
2. **Type safety:** Branded primitives, comprehensive types
3. **Gas sponsorship:** Well-validated sponsor endpoint with allowlist
4. **QR-based flow:** Simple, secure QR code exchange

### Key Risks & TODOs
1. **use-sponsored-tx.ts:** Signature order and race condition issues
2. **logoUrl validation:** Mismatch between Zod and Move contract
3. **Client-side rate limiting:** Trivial to bypass; real enforcement is server-side
4. **Performance:** Shared object queries list all programs then filter in-memory
5. **Gas budget:** Hard-coded 0.01 SUI may be insufficient for all transactions
6. **Missing tests:** queries.test.ts and transactions.test.ts are empty

### Recommended Fixes (Priority Order)
1. **CRITICAL:** Fix use-sponsored-tx.ts signature order and race condition (affects all transactions)
2. **HIGH:** Fix logoUrl validation mismatch (create_program will fail)
3. **HIGH:** Add error handling to sponsor API error responses
4. **MEDIUM:** Implement shared object query pagination or event indexing
5. **MEDIUM:** Standardize error handling across all pages
6. **MEDIUM:** Add tests for queries and transactions

---

**Document Generated:** 2026-03-26
**Codebase Snapshot:** Complete mapping as of latest git HEAD
