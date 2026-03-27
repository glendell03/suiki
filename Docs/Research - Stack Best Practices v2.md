# Suiki Stack Best Practices v2
**Tech Stack**: Sui v2 | Next.js 16 App Router | React 19 | dApp Kit React v2 | TanStack Query v5 | Tailwind CSS v4

---

## 1. @mysten/sui v2 — Core SDK & Transactions

### What's New vs v1
- **SuiGrpcClient** replaces legacy RPC for subscriptions and real-time data
- **Transaction class (PTB)** is the standard; imperative `TransactionBlock` patterns deprecated
- **Sponsored transactions** now baked into Transaction builder API
- **core API** vs **JSON-RPC**: gRPC client preferred for scale, JSON-RPC still available for compatibility

### Key Patterns
- Use `SuiGrpcClient` for real-time account/object subscriptions and performance-critical paths
- Build transactions with `Transaction` class (Program Transaction Builder pattern):
  ```typescript
  const tx = new Transaction();
  tx.moveCall({ target: "0x2::coin::split", arguments: [...] });
  tx.transferObjects([splitCoin], tx.pure.address(recipient));
  ```
- For sponsored transactions, use the Transaction builder's sponsor/gas methods directly
- Prefer **gRPC** for production queries; JSON-RPC acceptable for tooling/testing

### Anti-Patterns
- Do NOT use legacy `TransactionBlock`; migrate to `Transaction` class immediately
- Do NOT call raw JSON-RPC endpoints in hot paths; use gRPC for subscriptions
- Do NOT build transactions imperatively outside the Transaction class abstraction
- Do NOT assume all objects are Sui Framework types; verify ownership and mutability

---

## 2. @mysten/dapp-kit-react v2 — DApp Integration

### What's New vs v1
- **createDAppKit factory** is the new initialization pattern (replaces direct provider setup)
- **useDAppKit** hook replaces older context consumers
- **useCurrentAccount** for active wallet (replaces multiple context reads)
- **useSuiClientQuery** REMOVED; use TanStack Query v5 directly with `useCurrentClient()`
- **ConnectButton** is now the standard UI component (fully controlled)

### Key Patterns
- Initialize in `app.tsx` or layout root:
  ```typescript
  const dappKit = createDAppKit({
    connectors: [new StandardWalletAdapter()],
    autoConnect: true,
  });
  ```
- Wrap tree with `<DAppKitProvider>` and pass `dappKit` instance
- Get current account and client:
  ```typescript
  const account = useCurrentAccount();
  const client = useCurrentClient();
  ```
- Use `useDAppKit()` to access `signAndExecuteTransaction`:
  ```typescript
  const { signAndExecuteTransaction } = useDAppKit();
  await signAndExecuteTransaction({ transaction: tx, chain: "sui:mainnet" });
  ```
- Combine `useCurrentClient()` with TanStack Query v5 for reads:
  ```typescript
  const client = useCurrentClient();
  const { data } = useQuery({
    queryKey: ["object", objectId],
    queryFn: () => client.getObject({ id: objectId }),
  });
  ```

### Anti-Patterns
- Do NOT use `useSuiClientQuery`; it no longer exists—use React Query directly
- Do NOT initialize dApp kit in multiple places; single root instance only
- Do NOT call `signAndExecuteTransaction` without checking `account` is connected first
- Do NOT forget to set `chain` parameter when signing (prevents chain confusion)

---

## 3. Next.js 16 App Router — Modern Routing & Server Components

### What's New vs v13
- Server components are DEFAULT; client components must be explicit (`"use client"`)
- Route handlers (API routes) are now in `app/api/[route]/route.ts`
- Layouts are inheritable and support layout-level data fetching
- **Metadata/viewport** exports from page/layout files (no need for `Head` component)
- Streaming & partial pre-rendering for improved performance

### Key Patterns
- **Server components** for layout containers, data fetching, private logic:
  ```typescript
  // app/layout.tsx — server component by default
  export const metadata = { title: "Suiki" };
  export default function RootLayout({ children }) {
    return <html>...</html>;
  }
  ```
- **Client components** only where needed (interactivity, hooks, browser APIs):
  ```typescript
  "use client";
  import { useCurrentAccount } from "@mysten/dapp-kit-react";
  export default function Profile() { ... }
  ```
- **Route handlers** for API endpoints:
  ```typescript
  // app/api/transfer/route.ts
  export async function POST(req) {
    const { tx } = await req.json();
    return Response.json({ success: true });
  }
  ```
- Use `Suspense` boundaries for streaming:
  ```typescript
  <Suspense fallback={<Skeleton />}>
    <AsyncComponent />
  </Suspense>
  ```

### Anti-Patterns
- Do NOT mark everything as `"use client"`; only interactive pieces
- Do NOT fetch data in client components when server components can do it
- Do NOT import server-only modules into client components
- Do NOT use old `pages/` directory; migrate to `app/` exclusively

---

## 4. React 19 — New Hooks & Concurrent Features

### What's New vs v18
- **useActionState** replaces form submission patterns; integrates with server actions
- **useFormStatus** for form submission UI feedback
- **Suspense** fully supported for data fetching boundaries
- **Concurrent rendering** improves responsiveness (automatic, no API changes needed)
- **Refs** can be passed as props without forwardRef boilerplate

### Key Patterns
- Use `useActionState` for forms with server-side validation:
  ```typescript
  const [state, formAction] = useActionState(serverAction, initialState);
  return <form action={formAction}><input name="address" /><button>Transfer</button></form>;
  ```
- `useFormStatus` for loading/success feedback on submit:
  ```typescript
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? "Sending..." : "Send"}</button>;
  ```
- Combine `Suspense` with async components for streaming:
  ```typescript
  <Suspense fallback={<div>Loading...</div>}>
    <AsyncDataComponent />
  </Suspense>
  ```
- Use refs natively without `forwardRef` for simple passes-through

### Anti-Patterns
- Do NOT use `useState` + manual submission handlers for forms; use `useActionState`
- Do NOT mix server actions and client-side form handlers unnecessarily
- Do NOT ignore Suspense boundaries; always provide fallbacks
- Do NOT store server action results in component state; use `useActionState` state

---

## 5. @tanstack/react-query v5 — Data Fetching & Caching

### What's New vs v4
- **Options API simplified**: `enabled` guard pattern for conditional queries
- **useSuiClientQuery REMOVED** — use React Query directly with Sui client
- **invalidateQueries** after `waitForTransaction` for automatic refetches
- Mutation key factories and hooks are fully typed
- Better TypeScript inference for cache keys

### Key Patterns
- Query with enabled guard for conditional fetching:
  ```typescript
  const { data: object } = useQuery({
    queryKey: ["object", objectId],
    queryFn: () => suiClient.getObject({ id: objectId }),
    enabled: !!objectId, // Only fetch if objectId exists
  });
  ```
- Invalidate on transaction success:
  ```typescript
  const { mutate } = useMutation({
    mutationFn: async (tx) => {
      const result = await signAndExecuteTransaction({ transaction: tx });
      await suiClient.waitForTransaction({ digest: result.digest });
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["object"] });
    },
  });
  ```
- Query stale time & garbage collection:
  ```typescript
  useQuery({
    queryKey: ["balance", address],
    queryFn: () => getBalance(address),
    staleTime: 30 * 1000, // 30s
    gcTime: 5 * 60 * 1000, // 5m (formerly cacheTime)
  });
  ```

### Anti-Patterns
- Do NOT fetch data on every render; let React Query cache and deduplicate
- Do NOT forget `enabled: !!dependency` for dependent queries
- Do NOT skip invalidation after transactions; use `onSuccess` callback
- Do NOT set staleTime to 0; tune based on data freshness requirements

---

## 6. TypeScript Strict Mode — Type Safety Best Practices

### What's New vs Loose Mode
- All implicit `any` rejected; every value must have explicit or inferred type
- Strict null checks force `?` and guards on nullable values
- **Branded types** for runtime safety (e.g., `type Address = string & { readonly __brand: "Address" }`)
- **Discriminated unions** for exhaustive pattern matching
- **satisfies operator** validates against type without inference

### Key Patterns
- Branded types for domain values:
  ```typescript
  type SuiAddress = string & { readonly __brand: "SuiAddress" };
  const createAddress = (addr: string): SuiAddress => {
    if (!isValidSuiAddress(addr)) throw new Error("Invalid");
    return addr as SuiAddress;
  };
  ```
- Discriminated unions for state machines:
  ```typescript
  type TransactionState =
    | { status: "idle" }
    | { status: "pending"; digest: string }
    | { status: "success"; result: TransactionResult }
    | { status: "error"; error: string };
  ```
- satisfies for const validation:
  ```typescript
  const config = { timeout: 5000, retries: 3 } satisfies AppConfig;
  ```
- Exhaustive pattern matching with never:
  ```typescript
  const handle = (state: TransactionState) => {
    switch (state.status) {
      case "idle": return null;
      case "pending": return <Spinner />;
      case "success": return <Success />;
      case "error": return <Error />;
      default: const _: never = state;
    }
  };
  ```

### Anti-Patterns
- Do NOT use `any` to silence type errors; fix the underlying issue
- Do NOT assume `null` is not possible; use union types and guards
- Do NOT mix branded and plain strings; enforce type conversions at boundaries
- Do NOT leave union types without discriminator properties

---

## 7. Tailwind CSS v4 — New Syntax & Variables

### What's New vs v3
- **@import syntax** replaces @tailwind directives (cleaner, more composable)
- **CSS variables** for dynamic theming (built-in, no plugin needed)
- No more arbitrary value brackets; use CSS variables instead
- **Mobile-first responsive** (default `xs` breakpoint added)
- Theme customization now in CSS, not JavaScript

### Key Patterns
- Modern import syntax in `app.css`:
  ```css
  @import "tailwindcss";
  @import "tailwindcss/theme" layer(theme);
  @import "./custom-theme.css" layer(theme);
  ```
- CSS variables for theming:
  ```css
  :root {
    --color-primary: #3b82f6;
    --color-accent: #f59e0b;
  }
  @theme {
    --color-primary: var(--color-primary);
    --color-accent: var(--color-accent);
  }
  ```
- Mobile-first responsive (no `sm:` prefix for base styles):
  ```tsx
  <div className="p-4 md:p-8 lg:p-12">Responsive padding</div>
  ```
- Dark mode with CSS variables:
  ```css
  @media (prefers-color-scheme: dark) {
    :root {
      --color-primary: #1e40af;
    }
  }
  ```

### Anti-Patterns
- Do NOT use arbitrary values `[...]` for branding; use CSS variables in theme
- Do NOT add multiple Tailwind plugins for features now in core v4
- Do NOT mix old `@tailwind` directives with new `@import` syntax in same file
- Do NOT hardcode colors; reference theme variables via `text-[var(--color)]`

---

## 8. next-pwa & PWA Patterns — Offline & Installation

### What's New vs Manual Setup
- **@ducanh2912/next-pwa** is the standard for Next.js 16 PWA support
- Service worker auto-generated from config (no manual SW file needed)
- Manifest generation from `public/manifest.json` or config
- Offline fallback page handling
- Cache strategies (network-first, stale-while-revalidate, cache-first)

### Key Patterns
- Configure PWA in `next.config.ts`:
  ```typescript
  import withPWA from "@ducanh2912/next-pwa";

  export default withPWA({
    dest: "public",
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === "development",
  })(nextConfig);
  ```
- Manifest in `public/manifest.json`:
  ```json
  {
    "name": "Suiki",
    "short_name": "Suiki",
    "start_url": "/",
    "icons": [{ "src": "/icon.png", "sizes": "192x192", "type": "image/png" }],
    "theme_color": "#ffffff",
    "display": "standalone"
  }
  ```
- Install prompt with React:
  ```typescript
  "use client";
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    setDeferredPrompt(e);
  });
  const handleInstall = () => deferredPrompt?.prompt();
  ```
- Cache strategies in service worker config:
  ```typescript
  runtimeCaching: [
    { urlPattern: /^https:\/\/api\./, strategy: "network-first" },
    { urlPattern: /^https:\/\/cdn\./, strategy: "cache-first" },
  ]
  ```

### Anti-Patterns
- Do NOT manually create service workers; let next-pwa generate them
- Do NOT ignore `skipWaiting: true` during development; slows iteration
- Do NOT cache API responses indefinitely; use `network-first` for data
- Do NOT forget metadata exports for PWA-compatible manifests
- Do NOT assume offline content will load; provide fallback UI

---

## Summary: Cross-Technology Patterns

### State Management
- **Server state**: React Query + Sui client
- **UI state**: React 19 hooks (`useState`, `useReducer`)
- **Form state**: `useActionState` for server-side validation
- **Wallet state**: `useCurrentAccount` + dApp Kit

### Data Fetching Strategy
1. **Server components** fetch data at render time (RSC)
2. **Client components** use React Query with Sui client
3. **Real-time updates** use SuiGrpcClient subscriptions
4. **Mutations** use `signAndExecuteTransaction` + invalidation

### Type Safety
- **Branded types** for Sui addresses and transaction digests
- **Discriminated unions** for transaction/wallet states
- **Strict null checks** on all nullable Sui objects
- **satisfies operator** for config validation

### Performance
- **Suspense boundaries** for streaming components
- **Query stale times** tuned per data freshness needs
- **CSS variables** for dynamic theming without JS overhead
- **Service worker** for offline Sui queries and QR scanning

---

**Last Updated**: 2026-03-25
**Package Versions**: next@16.2.1 | react@19.2.4 | @mysten/sui@2.11.0 | @tanstack/react-query@5.95.2
