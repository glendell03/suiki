# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
pnpm dev          # Start dev server (Turbopack)
pnpm build        # Production build
pnpm start        # Start production server
pnpm test         # Run tests once (Vitest)
pnpm test:watch   # Run tests in watch mode
```

Run a single test file:
```bash
pnpm vitest run src/lib/__tests__/queries.test.ts
```

## Architecture

Suiki is a blockchain-powered merchant loyalty stamp-card dApp on the Sui network.

**Stack**: Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · TanStack Query v5 · Vitest

**Key boundaries**:
- `src/app/` — Next.js routes; split into `merchant/` and `customer/` domains
- `src/lib/sui-client.ts` — **Server-only** `SuiGrpcClient` singleton; import `suiClient` from here, never instantiate elsewhere
- `src/lib/transactions.ts` — Sui transaction builders (client-side)
- `src/lib/queries.ts` — Data-fetching utilities (server or React Query)
- `src/hooks/` — React Query hooks wrapping `lib/queries.ts`
- `src/app/providers.tsx` — Root provider tree: `QueryClientProvider` → `DAppKitProvider`
- `src/env.ts` — `@t3-oss/env-nextjs` schema; all env vars must be declared here

**Env vars** (see `.env.local.example`):
- `SPONSOR_PRIVATE_KEY` — server-side transaction sponsorship key
- `NEXT_PUBLIC_SUI_NETWORK` — `mainnet` | `testnet` | `devnet`
- `NEXT_PUBLIC_PACKAGE_ID` — deployed Move package ID

**Move contracts** live in `move/suiki/`. Internal design docs are in `Docs/`.

## Move Package Deployment (Sui CLI 1.63+)

The CLI separates **build environment** (dependency resolution) from **publish target** (chain). DevNet is ephemeral — always use `test-publish` for it.

```bash
# Build
sui move build --build-env devnet

# Deploy to devnet (ephemeral — writes to Pub.devnet.toml, gitignored)
sui client test-publish --build-env testnet --gas-budget 100000000

# Deploy to testnet (persistent — writes to Published.toml, commit this)
sui client publish --build-env testnet --gas-budget 100000000
```

After deploying, update `NEXT_PUBLIC_PACKAGE_ID` in `.env.local` with the `published-at` value from the output.

**Testing note**: `*.test.tsx` component tests are excluded from the Vitest config until `jsdom` and `@testing-library/react` are added (see `Docs/qa-dependencies-needed.md`). Only `*.test.ts` lib tests run currently.

**Next.js**: This project uses Next.js 16 which has breaking changes from prior versions. Read `node_modules/next/dist/docs/` before modifying Next.js-specific code.

## UI/UX System (Sprint 4)

The design uses a **black & white minimal theme** — white background, black as the primary CTA color, amber gold as the loyalty accent. Key rules:

### New Components (src/components/)
All new shared components are in flat `src/components/` (not feature-specific).
Import from `@/components/[component-name]`.

### Design Token Usage
- Use CSS variable parenthesis syntax (Tailwind v4): `bg-(--color-primary)`, `text-(--color-text-secondary)`
- NEVER use bracket syntax `bg-[--color-*]` — Tailwind v4 generates empty CSS rules for that form
- NEVER use raw hex values in JSX — always use design tokens from globals.css
- Glass effect: use `.glass-card` CSS class (not inline styles)
- Press animation: use `.tap-target` CSS class on tappable elements

### Navigation
- Customer routes use `BottomNav` component for navigation
- Merchant routes use a separate simple header (no bottom nav)
- PageShell wraps every customer page

### QR Codes
- ALL QR codes use `BeautifulQR` component from `@/components/beautiful-qr`
- NEVER use raw `qrcode.react` in UI components
- QR payload encoding/decoding in `src/lib/qr-utils.ts`

### No NFC
The project does not implement NFC. All stamp collection is QR-code only.

### Performance Budget
- No `backdrop-filter: blur()` on list items or cards — use `.glass-card` which uses semi-transparent bg
- Only `BottomNav` and modal overlays use actual CSS blur
