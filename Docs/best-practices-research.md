# Production Best Practices Research

## Overview

This document consolidates production best practices and breaking changes for every major dependency in the Suiki project. It is organized by package and includes recommendations for the Next.js 16 + React 19 + Tailwind v4 stack.

**Last updated**: March 26, 2026

---

## Table of Contents

1. [Next.js 16](#nextjs-16)
2. [React 19](#react-19)
3. [Tailwind CSS v4](#tailwind-css-v4)
4. [TanStack Query v5](#tanstack-query-v5)
5. [TanStack React Form v1](#tanstack-react-form-v1)
6. [@mysten/dapp-kit-react v2](#mystenDappKitReact-v2)
7. [@mysten/sui v2](#mystenSui-v2)
8. [Zod v4](#zod-v4)
9. [@t3-oss/env-nextjs](#t3-ossEnvNextjs)
10. [@ducanh2912/next-pwa](#ducanh2912NextPwa)
11. [QR Code Libraries](#qr-code-libraries)
12. [Lucide React Icons](#lucide-react-icons)
13. [Vitest](#vitest)

---

## Next.js 16

### Version
- **Current**: 16.2.1
- **Built on**: React 19
- **Turbopack**: Now default build system (replaces webpack)
- **App Router**: Stable, Server Components by default

### Key Breaking Changes vs v15

1. **Server Components are Default**
   - All files in `app/` are Server Components unless marked with `'use client'`
   - Server Components cannot use hooks, event listeners, or browser APIs
   - Reduces JavaScript sent to browser by default

2. **Dynamic Imports with `dynamic()`**
   - Must be used for client-side code that needs SSR: `dynamic(() => import('...'), { ssr: false })`
   - See providers.tsx for correct pattern with `DAppKitProvider`

3. **Metadata and Viewport Exports**
   - Only available in Server Components
   - `layout.tsx` exports `Metadata` and `Viewport`
   - Clients cannot use these exports

4. **HMR Dev Origins**
   - Next.js 16 rejects non-localhost HMR origins by default
   - Solution: Use `allowedDevOrigins` in config for tunnels (e.g., Cloudflare)
   - See `next.config.ts` for implementation

5. **Turbopack with PWA**
   - Turbopack is dev server only; production still uses SWC
   - PWA service workers are built at production time, not during dev
   - Explicitly declare `turbopack: {}` in config to prevent webpack collision

### Recommended Patterns

**Server vs Client Boundary**
```tsx
// app/layout.tsx — Server Component (default)
// Can use metadata, database queries, private env vars
export const metadata = { title: "Suiki" };

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {/* Extract client components to separate file */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```tsx
// app/providers.tsx — Client Component ('use client')
// Wraps tree with context providers
'use client';

import { QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

**Extracting Client Components to Keep Layouts Server**
```tsx
// DO: Separate client component for wallet connection
// app/site-header.tsx
'use client';

import { ConnectButton } from '@mysten/dapp-kit-react';

export function SiteHeader() {
  return <ConnectButton />;
}

// app/layout.tsx — remains Server Component
import { SiteHeader } from './site-header';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SiteHeader /> {/* OK: SiteHeader is already a Client Component */}
        {children}
      </body>
    </html>
  );
}
```

### Common Mistakes to Avoid

1. **Putting 'use client' at the root of layout.tsx**
   - Makes entire app client-side, losing SSR benefits
   - Extract providers/client components instead

2. **Using hooks or client APIs in Server Components**
   - `useState`, `useEffect`, `useRouter`, browser APIs → errors
   - Move to `'use client'` component

3. **Not importing from `next/navigation` in Client Components**
   - Client: `import { useRouter } from 'next/navigation'`
   - Server: `import { redirect } from 'next/navigation'` (redirects during render)

4. **Importing third-party client-only libraries in Server Components**
   - Solution: Wrap in a `'use client'` wrapper component

### Performance Best Practices

1. **Minimize 'use client' scope**
   - Only wrap the smallest component that needs client features
   - Keeps more of your app Server-rendered

2. **Prefetch data on the server**
   - Use `getObject()` or `fetchQuery()` in Server Components
   - Pass data down as props, hydrate with TanStack Query

3. **Static generation (ISR)**
   - Pages without dynamic parameters are static by default
   - Use `revalidatePath()` or `revalidateTag()` for on-demand revalidation
   - See Move package deployment docs for contract updates

4. **Image optimization**
   - Use `next/image` with `priority` for above-the-fold content
   - Automatic WebP, AVIF conversion

### TypeScript Usage

```tsx
// Strongly type Next.js metadata and viewport
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Suiki',
  description: 'Loyalty cards on Sui',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Mobile PWA: prevent iOS zoom on input
  userScalable: false,
};
```

---

## React 19

### Version
- **Current**: 19.2.4
- **Key New Features**: Actions, `use()`, `useOptimistic`, `useFormStatus`

### Key New Hooks

#### 1. `use()` — Unwrap Promises

Unwraps a Promise or Context in a component. Replaces `Suspense` workarounds for data fetching.

```tsx
// Client Component
'use client';

import { use } from 'react';
import { fetchPosts } from './actions';

export function Posts({ postsPromise }) {
  const posts = use(postsPromise);
  return posts.map(post => <div key={post.id}>{post.title}</div>);
}

// Server Component passes Promise
export default async function PostsPage() {
  const postsPromise = fetchPosts();
  return <Posts postsPromise={postsPromise} />;
}
```

#### 2. `useOptimistic` — Optimistic UI Updates

Update UI immediately while async action runs in background.

```tsx
'use client';

import { useOptimistic, startTransition } from 'react';
import { toggleLike } from './actions';

export function LikeButton({ isLiked, onToggle }) {
  const [optimisticIsLiked, setOptimisticIsLiked] = useOptimistic(isLiked);

  function handleClick() {
    startTransition(async () => {
      // Update UI immediately
      setOptimisticIsLiked(!optimisticIsLiked);
      // Run async action
      await toggleLike(!optimisticIsLiked);
    });
  }

  return (
    <button onClick={handleClick}>
      {optimisticIsLiked ? '❤️' : '🤍'}
    </button>
  );
}
```

#### 3. `useFormStatus` — Track Form Submission

Access pending state in child components (forms only).

```tsx
'use client';

import { useFormStatus } from 'react-dom';
import { submitStampCard } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Submitting...' : 'Submit'}
    </button>
  );
}

export default function CardForm() {
  return (
    <form action={submitStampCard}>
      <input name="programId" />
      <SubmitButton />
    </form>
  );
}
```

#### 4. `useActionState` — Form Actions with State

Combine form actions with error handling and submission state.

```tsx
'use client';

import { useActionState } from 'react';
import { updateName } from './actions';

export function NameForm({ currentName }) {
  const [error, submitAction, isPending] = useActionState(
    async (previousState, formData) => {
      const error = await updateName(formData.get('name'));
      if (error) return error; // Display error
      return null; // Success
    },
    null // Initial state
  );

  return (
    <form action={submitAction}>
      <input name="name" defaultValue={currentName} />
      <button type="submit" disabled={isPending}>
        Update
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}
```

### Server Actions Pattern

Server Actions allow async operations from Client Components without API routes.

```tsx
// lib/actions.ts — Server file (can use private keys, databases)
'use server';

import { suiClient } from '@/lib/sui-client';

export async function sponsorTransaction(txBytes: string) {
  try {
    const result = await suiClient.executeTransactionBlock({
      transactionBlock: txBytes,
      signer: sponsorKeypair, // Private env var
    });
    return { success: true, digest: result.digest };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

```tsx
// app/page.tsx — Client Component
'use client';

import { useTransition } from 'react';
import { sponsorTransaction } from '@/lib/actions';

export function TransactionForm({ txBytes }) {
  const [isPending, startTransition] = useTransition();

  async function handleSubmit() {
    startTransition(async () => {
      const result = await sponsorTransaction(txBytes);
      if (result.success) {
        console.log('Tx digest:', result.digest);
      } else {
        console.error('Failed:', result.error);
      }
    });
  }

  return (
    <button onClick={handleSubmit} disabled={isPending}>
      {isPending ? 'Sponsoring...' : 'Sponsor Transaction'}
    </button>
  );
}
```

### Common Mistakes to Avoid

1. **Using `use()` on non-Promise values**
   - Only works on Promises or Context
   - For normal data, just access directly

2. **Calling Server Actions from Server Components**
   - Server Actions are for calling from Client Components
   - Direct async/await in Server Components is simpler

3. **Forgetting `'use server'` directive**
   - Server Actions must have `'use server'` at file or function level
   - Without it, code runs client-side and exposes secrets

4. **Not handling errors in Server Actions**
   - Always return error state, not throw
   - Exceptions don't reach client as typed errors

### Performance Best Practices

1. **Use Server Actions for data mutations**
   - Reduces client JS, improves security
   - Example: `sponsorTransaction` uses private key server-side

2. **Combine with `useOptimistic` for better UX**
   - Update UI immediately, revert if action fails

3. **Keep Server Actions small and focused**
   - One action per mutation (not one mega action)

4. **Use `startTransition` to manage pending state**
   - Prevents layout thrash, allows proper loading UI

### TypeScript Usage

```tsx
// Strongly type Server Action results
'use server';

export async function submitCard(formData: FormData): Promise<{
  success: boolean;
  cardId?: string;
  error?: string;
}> {
  try {
    const card = await createCard(formData.get('programId') as string);
    return { success: true, cardId: card.objectId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

---

## Tailwind CSS v4

### Version
- **Current**: 4.x (CSS-first, no `tailwind.config.js`)
- **Major Change**: Configuration moved from JS to CSS

### CSS-First Configuration

Tailwind v4 requires NO `tailwind.config.js`. All config is in CSS:

```css
/* src/app/globals.css — Suiki example */
@import "tailwindcss";

:root {
  /* Design tokens as CSS custom properties */
  --color-primary: #3b82f6;
  --color-accent-loyalty: #f59e0b;
  --color-bg-base: #0f172a;
  --font-body: var(--font-geist-sans), system-ui, sans-serif;
}

@theme inline {
  /* Expose tokens as Tailwind utilities */
  --color-background: var(--color-bg-base);
  --color-foreground: #f1f5f9;
  --font-sans: var(--font-body);
}

/* Base reset for mobile PWA */
* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
  -webkit-text-size-adjust: 100%;
}

body {
  background-color: var(--color-bg-base);
  color: #f1f5f9;
  font-family: var(--font-body);
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
}
```

### Key Differences from v3

| Feature | v3 | v4 |
|---------|----|----|
| Config file | `tailwind.config.js` | CSS `@theme` directive |
| Design tokens | JS objects | CSS custom properties |
| @layer | In CSS after config | In CSS with @theme |
| PostCSS plugin | Separate step | Auto-integrated |
| Bundle size | Larger | Smaller (CSS-first) |

### Design System Pattern (Suiki)

Use CSS custom properties as single source of truth:

```css
:root {
  /* Color palette */
  --color-primary: #3b82f6;
  --color-primary-light: #60a5fa;
  --color-primary-dark: #2563eb;

  --color-accent-loyalty: #f59e0b;
  --color-accent-loyalty-muted: #78350f;

  /* Surfaces */
  --color-bg-base: #0f172a;
  --color-bg-surface: #1e293b;
  --color-bg-elevated: #334155;

  /* Text */
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #475569;

  /* Semantic */
  --color-success: #22c55e;
  --color-error: #ef4444;
  --color-warning: #f59e0b;

  /* Spacing */
  --radius-base: 0.75rem;
  --radius-pill: 9999px;
}

@theme inline {
  --color-background: var(--color-bg-base);
  --color-foreground: var(--color-text-primary);
  --font-sans: var(--font-body);
}
```

Then use in components:
```tsx
export function StampCard() {
  return (
    <div className="bg-[--color-bg-surface] rounded-[--radius-base]">
      <div className="text-[--color-text-primary]">
        {/* Tailwind resolves CSS variables automatically */}
      </div>
    </div>
  );
}
```

### Dark Mode (Not Applicable to Suiki)

Tailwind v4 supports dark mode via CSS media queries, but Suiki is **always dark** (no light theme). Design system is unconditional.

### Common Mistakes to Avoid

1. **Creating a `tailwind.config.js` when not needed**
   - v4 doesn't use it; everything goes in CSS
   - If needed for plugins, extend `@theme` in CSS

2. **Not exposing custom properties to `@theme`**
   - Properties not in `@theme` won't generate Tailwind utilities
   - Always declare design tokens in `@theme inline`

3. **Using inline styles instead of custom properties**
   - Bad: `style={{ color: '#3b82f6' }}`
   - Good: `className="text-[--color-primary]"`
   - Enables single-source-of-truth updates

4. **Forgetting `@import "tailwindcss"` at top of globals.css**
   - Required for v4 CSS-first mode

### Performance Best Practices

1. **Define all design tokens in CSS**
   - No JS objects to parse
   - Faster load times

2. **Use CSS custom properties with `@theme`**
   - Enables postcss tree-shaking
   - Unused tokens aren't included in output

3. **Minimize @layer overrides**
   - Each @layer directive adds weight
   - Prefer extending tokens to overriding base styles

4. **Leverage automatic responsive variants**
   ```css
   @theme inline {
     --breakpoint-sm: 640px;
     --breakpoint-md: 768px;
   }
   ```
   Then: `className="text-sm md:text-lg"` works automatically

### TypeScript Usage

No TypeScript needed for Tailwind v4 (pure CSS), but type your component props:

```tsx
interface CardProps {
  variant?: 'primary' | 'secondary' | 'loyalty';
  children: React.ReactNode;
}

export function Card({ variant = 'primary', children }: CardProps) {
  const bgColor = {
    primary: 'bg-[--color-bg-surface]',
    secondary: 'bg-[--color-bg-elevated]',
    loyalty: 'bg-[--color-accent-loyalty]',
  }[variant];

  return <div className={`rounded-[--radius-base] ${bgColor}`}>{children}</div>;
}
```

---

## TanStack Query v5

### Version
- **Current**: 5.95.2
- **Major Change**: `Hydrate` → `HydrationBoundary`, no `useHydrate`

### Server Component Prefetching Pattern

Prefetch data on the server, hydrate on the client:

```tsx
// lib/get-query-client.ts — Reusable factory
import { QueryClient } from '@tanstack/react-query';

export function getQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 min
      },
    },
  });
}
```

```tsx
// app/merchant/[programId]/page.tsx — Server Component
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/get-query-client';
import { getProgramById } from '@/lib/queries';
import { ProgramDetails } from './program-details';

export default async function ProgramPage({
  params,
}: {
  params: { programId: string };
}) {
  const queryClient = getQueryClient();

  // Prefetch on server
  void queryClient.prefetchQuery({
    queryKey: ['program', params.programId],
    queryFn: () => getProgramById(params.programId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProgramDetails programId={params.programId} />
    </HydrationBoundary>
  );
}
```

```tsx
// app/merchant/[programId]/program-details.tsx — Client Component
'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { getProgramById } from '@/lib/queries';

export function ProgramDetails({ programId }: { programId: string }) {
  // Data is already cached from server prefetch
  const { data: program } = useSuspenseQuery({
    queryKey: ['program', programId],
    queryFn: () => getProgramById(programId),
  });

  return (
    <div>
      <h1>{program.name}</h1>
      <p>Stamps Required: {program.stampsRequired}</p>
    </div>
  );
}
```

### Key API Changes

| v4 | v5 |
|----|-----|
| `Hydrate` | `HydrationBoundary` |
| `useHydrate()` | None (automatic in `HydrationBoundary`) |
| `useQuery()` | Still available |
| N/A | `useSuspenseQuery()` — throws Promise until data loads |

### useSuspenseQuery vs useQuery

```tsx
// useSuspenseQuery — data is guaranteed (throws Promise if loading)
const { data } = useSuspenseQuery({
  queryKey: ['program', id],
  queryFn: fetchProgram,
});
// data is never undefined

// useQuery — data may be undefined
const { data, isLoading } = useQuery({
  queryKey: ['program', id],
  queryFn: fetchProgram,
});
// data is undefined while loading
```

Use `useSuspenseQuery` with `<Suspense>` boundaries:

```tsx
'use client';

import { Suspense } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

function ProgramSuspense({ id }) {
  const { data } = useSuspenseQuery({
    queryKey: ['program', id],
    queryFn: () => getProgramById(id),
  });
  return <div>{data.name}</div>;
}

export function ProgramContainer({ id }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProgramSuspense id={id} />
    </Suspense>
  );
}
```

### Background Refetching

Keep data fresh without blocking UI:

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';

export function MyCards() {
  const { data: cards, isRefetching } = useQuery({
    queryKey: ['cards', customerId],
    queryFn: () => getCardsByCustomer(customerId),
    refetchInterval: 10 * 1000, // 10 seconds
  });

  return (
    <div>
      {isRefetching && <span>Updating...</span>}
      {cards?.map(card => <Card key={card.objectId} {...card} />)}
    </div>
  );
}
```

### Common Mistakes to Avoid

1. **Using old `Hydrate` component**
   - Only `HydrationBoundary` works in v5
   - Migration: remove `useHydrate()`, wrap in `HydrationBoundary`

2. **Not wrapping prefetched queries in `HydrationBoundary`**
   - Causes double fetch (server + client)
   - Always: `<HydrationBoundary state={dehydrate(queryClient)}>`

3. **Mixing prefetched and client-only queries**
   - Acceptable: some queries prefetched, others client-only
   - Just make sure hydration boundaries are correct

4. **Over-prefetching on server**
   - Prefetch only critical data
   - Use `staleTime` to avoid refetch immediately
   - Let other queries fetch client-side

### Performance Best Practices

1. **Prefetch only above-the-fold data**
   - Heavy operations (batch fetches) → client-side
   - Critical user data → server prefetch

2. **Set appropriate `staleTime`**
   ```tsx
   new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 60 * 1000, // 1 min, avoid immediate refetch
       },
     },
   })
   ```

3. **Use `refetchOnWindowFocus: false` in dev**
   - Prevents unwanted refetches when switching tabs
   - Keep true in production

4. **Batch fetch objects on server**
   - Example: `suiClient.getObjects({ objectIds: [...] })`
   - Better than N individual `getObject()` calls

### TypeScript Usage

```tsx
// Strongly type query results
const { data: program } = useSuspenseQuery<StampProgram, Error>({
  queryKey: ['program', id],
  queryFn: () => getProgramById(id),
});

// Or with inference
const { data: program } = useSuspenseQuery({
  queryKey: ['program', id],
  queryFn: async () => {
    const prog = await getProgramById(id);
    return prog; // Type inferred as StampProgram
  },
});
```

---

## TanStack React Form v1

### Version
- **Current**: 1.28.5
- **Type-Safe**: Full TypeScript support, optional validation

### Basic Form Setup

```tsx
'use client';

import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { z } from 'zod';

const createCardSchema = z.object({
  programId: z.string().min(1, 'Program required'),
  preferredReward: z.string().optional(),
});

export function CreateCardForm() {
  const form = useForm({
    defaultValues: {
      programId: '',
      preferredReward: '',
    },
    validatorAdapter: zodValidator(),
    onSubmit: async ({ value }) => {
      const result = await createCard(value);
      if (result.success) {
        console.log('Card created:', result.cardId);
      } else {
        return { form: result.error };
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="programId"
        validators={{
          onChange: createCardSchema.shape.programId,
        }}
        children={(field) => (
          <div>
            <label htmlFor={field.name}>Program:</label>
            <select
              id={field.name}
              name={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            >
              <option value="">Select...</option>
              {programs.map((p) => (
                <option key={p.objectId} value={p.objectId}>
                  {p.name}
                </option>
              ))}
            </select>
            {field.state.meta.errors && (
              <em role="alert">{field.state.meta.errors.join(', ')}</em>
            )}
          </div>
        )}
      />

      <form.Field
        name="preferredReward"
        children={(field) => (
          <div>
            <label htmlFor={field.name}>Preferred Reward (optional):</label>
            <input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </div>
        )}
      />

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
        children={([canSubmit, isSubmitting]) => (
          <button type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Card'}
          </button>
        )}
      />
    </form>
  );
}
```

### Field Arrays (Dynamic Lists)

```tsx
'use client';

import { useForm } from '@tanstack/react-form';

export function BulkStampsForm() {
  const form = useForm({
    defaultValues: {
      stamps: [{ customerId: '', count: 0 }],
    },
    onSubmit: async ({ value }) => {
      await bulkAwardStamps(value.stamps);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="stamps">
        {(field) => (
          <div>
            {field.state.value.map((stamp, index) => (
              <div key={index}>
                <form.Field name={`stamps[${index}].customerId`}>
                  {(subField) => (
                    <input
                      placeholder="Customer ID"
                      value={subField.state.value}
                      onChange={(e) =>
                        subField.handleChange(e.target.value)
                      }
                    />
                  )}
                </form.Field>

                <form.Field name={`stamps[${index}].count`}>
                  {(subField) => (
                    <input
                      type="number"
                      placeholder="Count"
                      value={subField.state.value}
                      onChange={(e) =>
                        subField.handleChange(Number(e.target.value))
                      }
                    />
                  )}
                </form.Field>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                field.pushValue({ customerId: '', count: 0 });
              }}
            >
              Add Stamp
            </button>
          </div>
        )}
      </form.Field>
    </form>
  );
}
```

### Server-Side Validation

Validate on submit before sending to server:

```tsx
'use client';

import { useForm } from '@tanstack/react-form';

export function StampForm() {
  const form = useForm({
    defaultValues: { customerId: '' },
    validators: {
      onSubmitAsync: async ({ value }) => {
        // Server-side validation
        const exists = await checkCustomerExists(value.customerId);
        if (!exists) {
          return {
            fields: {
              customerId: 'Customer not found',
            },
          };
        }
        return null;
      },
    },
    onSubmit: async ({ value }) => {
      // Submit after validation passes
      await awardStamp(value.customerId);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="customerId"
        children={(field) => (
          <input
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
          />
        )}
      />
      <form.Subscribe
        selector={(state) => state.errorMap}
        children={([errorMap]) =>
          errorMap.onSubmit ? (
            <em role="alert">{errorMap.onSubmit}</em>
          ) : null
        }
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Common Mistakes to Avoid

1. **Not using `form.handleSubmit()` in onSubmit handler**
   - Always call it to trigger validation and onSubmit callback

2. **Forgetting `onBlur={field.handleBlur}`**
   - Triggers blur-level validation

3. **Not subscribing to form state for submit button**
   - Should check `canSubmit` and `isSubmitting`

4. **Inline validation objects causing re-renders**
   - Define validators outside component or memoize

### Performance Best Practices

1. **Use `form.Subscribe` to avoid full re-renders**
   ```tsx
   // BAD: re-renders entire form on every state change
   {form.state.canSubmit && <button>Submit</button>}

   // GOOD: only subscribes to needed state
   <form.Subscribe
     selector={(state) => [state.canSubmit]}
     children={([canSubmit]) => <button disabled={!canSubmit}>Submit</button>}
   />
   ```

2. **Lazy load field arrays**
   - Only render visible items for large lists

3. **Debounce async validators**
   - Prevents excessive server calls while typing

---

## @mysten/dapp-kit-react v2

### Version
- **Current**: 2.0.1
- **Breaking Changes from v1**: Complete rewrite, new hooks, new module structure

### Setup (Suiki Pattern)

```tsx
// app/providers.tsx
'use client';

import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { createDAppKit } from '@mysten/dapp-kit-core';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const GRPC_URLS = {
  testnet: 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
} as const;

const dAppKit = createDAppKit({
  networks: ['testnet', 'mainnet', 'devnet'] as const,
  defaultNetwork: 'testnet',
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
});

// Type augmentation for useDAppKit()
declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      {children}
    </DAppKitProvider>
  );
}
```

### Key Hooks

#### 1. `useCurrentAccount()` — Get Connected Wallet

```tsx
'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';

export function UserInfo() {
  const account = useCurrentAccount();

  if (!account) {
    return <p>Connect wallet to continue</p>;
  }

  return <p>Connected: {account.address}</p>;
}
```

#### 2. `useSignAndExecuteTransaction()` — Sign and Send Tx

```tsx
'use client';

import { useSignAndExecuteTransaction } from '@mysten/dapp-kit-react';
import { Transaction } from '@mysten/sui/transactions';

export function SendButton() {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  async function handleSend() {
    const tx = new Transaction();
    tx.transferObjects([/* objects */], 'recipient_address');

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          console.log('Success:', result.digest);
        },
        onError: (error) => {
          console.error('Failed:', error);
        },
      }
    );
  }

  return <button onClick={handleSend}>Send Transaction</button>;
}
```

#### 3. `ConnectButton` — Pre-Built UI

```tsx
'use client';

import { ConnectButton } from '@mysten/dapp-kit-react';

export function SiteHeader() {
  return (
    <header>
      <h1>Suiki</h1>
      <ConnectButton /> {/* Wallet selection + account display */}
    </header>
  );
}
```

### Transaction Pattern (Suiki)

```tsx
'use client';

import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit-react';
import { Transaction } from '@mysten/sui/transactions';

export function AwardStampButton({ programId }: { programId: string }) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  async function handleAwardStamp() {
    if (!account) return;

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::award_stamp`,
      arguments: [
        tx.object(programId),
        tx.pure.address(account.address),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          console.log('Stamp awarded:', result.digest);
          // Refetch stamps
        },
        onError: (error) => {
          console.error('Error:', error.message);
        },
      }
    );
  }

  return (
    <button onClick={handleAwardStamp} disabled={!account || isPending}>
      {isPending ? 'Awarding...' : 'Award Stamp'}
    </button>
  );
}
```

### Common Mistakes to Avoid

1. **Not wrapping in `DAppKitProvider`**
   - All dApp Kit hooks require provider in parent tree
   - Place in `app/providers.tsx`

2. **Using `SuiClient` (JSON-RPC) on client**
   - Suiki uses `SuiGrpcClient` configured in dAppKit
   - For server-side only: use `src/lib/sui-client.ts`

3. **Not checking `account` before using `address`**
   - Always: `if (!account) return null;`

4. **Mixing multiple DAppKit instances**
   - Create one instance and reuse via hook
   - See module augmentation pattern above

### Performance Best Practices

1. **Prefetch wallet list**
   - dAppKit prefetches available wallets automatically

2. **Use `ConnectButton` for standard UI**
   - Don't build custom wallet selector
   - ConnectButton handles UX best practices

3. **Batch move calls**
   - Multiple stamps in one tx: `tx.moveCall(...); tx.moveCall(...);`
   - Better than separate transactions

### TypeScript Usage

```tsx
// Type transaction parameters
function awardStamp(
  tx: Transaction,
  programId: string,
  customerId: string
): void {
  tx.moveCall({
    target: `${PACKAGE_ID}::suiki::award_stamp`,
    arguments: [
      tx.object(programId),
      tx.pure.address(customerId),
    ],
  });
}

// Or with result type
async function executeAwardStamp(
  programId: string,
  customerId: string
): Promise<{ digest: string }> {
  const tx = new Transaction();
  awardStamp(tx, programId, customerId);

  const result = await dAppKit.signAndExecuteTransaction({
    transaction: tx,
  });

  if (result.FailedTransaction) {
    throw new Error(result.FailedTransaction.status.error?.message);
  }

  return { digest: result.Transaction.digest };
}
```

---

## @mysten/sui v2

### Version
- **Current**: 2.11.0
- **Key Client**: `SuiGrpcClient` (server), `Transaction` (both)

### Server-Side Usage

Always use `SuiGrpcClient` on server (faster, gRPC):

```ts
// src/lib/sui-client.ts — singleton, never instantiate elsewhere
import { SuiGrpcClient } from '@mysten/sui/grpc';

export const suiClient = new SuiGrpcClient({
  network: 'testnet' as const,
  baseUrl: 'https://fullnode.testnet.sui.io:443',
});
```

```ts
// src/lib/queries.ts — uses suiClient
import { suiClient } from './sui-client';

export async function getProgramsByMerchant(
  merchantAddress: string
): Promise<StampProgram[]> {
  const objectsResult = await suiClient.getObjects({
    objectIds: programIds,
    include: { json: true },
  });

  return objectsResult.objects.map((obj) =>
    parseStampProgram(obj.objectId, obj.json as Record<string, unknown>)
  );
}
```

### Transaction Building (Client)

Build transactions on client, sign via wallet:

```tsx
// src/lib/transactions.ts
import { Transaction } from '@mysten/sui/transactions';

export function buildAwardStampTx(
  programId: string,
  customerId: string
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::award_stamp`,
    arguments: [
      tx.object(programId),
      tx.pure.address(customerId),
    ],
  });
  return tx;
}
```

```tsx
// app/merchant/award/page.tsx
'use client';

import { useSignAndExecuteTransaction } from '@mysten/dapp-kit-react';
import { buildAwardStampTx } from '@/lib/transactions';

export function AwardStampButton() {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  function handleAward() {
    const tx = buildAwardStampTx(programId, customerId);
    signAndExecute({ transaction: tx });
  }

  return <button onClick={handleAward}>Award</button>;
}
```

### Batch Operations

Always batch when possible:

```ts
// Good: single getObjects() call
const objects = await suiClient.getObjects({
  objectIds: [id1, id2, id3],
  include: { json: true },
});

// Bad: three separate calls
const obj1 = await suiClient.getObject({ objectId: id1 });
const obj2 = await suiClient.getObject({ objectId: id2 });
const obj3 = await suiClient.getObject({ objectId: id3 });
```

### Event Querying (JSON-RPC Only)

gRPC doesn't support event queries, so use JSON-RPC for events:

```ts
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';

const jsonRpcClient = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl('testnet'),
});

export async function getCreationEvents(
  merchantAddress: string
): Promise<string[]> {
  const events = await jsonRpcClient.queryEvents({
    query: { Sender: merchantAddress },
    order: 'descending',
    limit: 50,
  });

  return events.data
    .filter((e) => e.type === `${PACKAGE_ID}::${MODULE_NAME}::ProgramCreated`)
    .map((e) => (e.parsedJson as any)?.program_id)
    .filter((id): id is string => typeof id === 'string');
}
```

### Common Mistakes to Avoid

1. **Creating multiple `SuiClient` or `SuiGrpcClient` instances**
   - Use singleton in `src/lib/sui-client.ts`
   - Never: `new SuiGrpcClient()` in multiple files

2. **Using gRPC for event queries**
   - Only JSON-RPC supports `queryEvents()`
   - See example above

3. **Not typing transaction arguments correctly**
   - `tx.pure.address()` for 0x addresses
   - `tx.pure.u64()` for numbers
   - `tx.object()` for object references

4. **Forgetting to await async operations**
   - All client methods are async

### Performance Best Practices

1. **Batch objects: use `getObjects()` not `getObject()`**
   - Single RPC call vs N calls

2. **Reuse `suiClient` singleton**
   - Connection pooling, better performance

3. **Cache event query results**
   - Events don't change after emission
   - Use TanStack Query with long `staleTime`

4. **Minimize RPC calls in loops**
   - Batch before loop: `getObjects([...])` then map

### TypeScript Usage

```tsx
// Type Move call arguments
type AwardStampArgs = [
  tx: Transaction,
  programId: string,
  customerId: string,
];

function buildAwardStamp(...[tx, programId, customerId]: AwardStampArgs) {
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::award_stamp`,
    arguments: [
      tx.object(programId),
      tx.pure.address(customerId),
    ],
  });
}
```

---

## Zod v4

### Version
- **Current**: 4.3.6
- **Major Improvement**: 100x faster TypeScript compilation vs v3

### Basic Validation

```ts
import { z } from 'zod';

// Schemas are the source of truth
export const StampCardSchema = z.object({
  programId: z.string().min(1, 'Program required'),
  customerId: z.string().startsWith('0x', 'Invalid address'),
  stampCount: z.number().int().min(0),
  earnedDate: z.date().optional(),
});

// Infer TypeScript type from schema
export type StampCard = z.infer<typeof StampCardSchema>;

// Parse and validate
const result = StampCardSchema.safeParse(data);

if (result.success) {
  const card: StampCard = result.data; // Type-safe
} else {
  console.error(result.error.flatten());
}
```

### Sui Address Validation

```ts
import { z } from 'zod';

// Sui addresses: 0x + 64 hex chars
export const SuiAddressSchema = z
  .string()
  .refine(
    (addr) => /^0x[a-fA-F0-9]{64}$/.test(addr),
    'Invalid Sui address'
  );

export const StampProgramSchema = z.object({
  objectId: SuiAddressSchema,
  merchant: SuiAddressSchema,
  name: z.string().min(1).max(100),
  stampsRequired: z.number().int().min(1).max(1000),
  rewardDescription: z.string().min(1),
});
```

### Nested Objects and Arrays

```ts
import { z } from 'zod';

export const BulkStampsSchema = z.object({
  programId: z.string(),
  entries: z.array(
    z.object({
      customerId: z.string(),
      stampCount: z.number().int().min(1),
    })
  ),
});

type BulkStamps = z.infer<typeof BulkStampsSchema>;
```

### Custom Validation

```ts
import { z } from 'zod';

export const CreateCardSchema = z.object({
  programId: z.string(),
  preferredReward: z.string().optional(),
}).refine(
  async (data) => {
    // Server-side: verify program exists
    const exists = await checkProgramExists(data.programId);
    return exists;
  },
  {
    message: 'Program not found',
    path: ['programId'],
  }
);
```

### Form Integration (TanStack Form + Zod)

```tsx
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { CreateCardSchema } from '@/lib/schemas';

export function CreateCardForm() {
  const form = useForm({
    defaultValues: {
      programId: '',
    },
    validatorAdapter: zodValidator(),
    validators: {
      onChange: CreateCardSchema,
      onSubmitAsync: CreateCardSchema,
    },
    onSubmit: async ({ value }) => {
      // value is guaranteed to match CreateCardSchema
      const result = await createCard(value);
      if (!result.success) {
        return { form: result.error };
      }
    },
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); void form.handleSubmit(); }}>
      {/* form fields */}
    </form>
  );
}
```

### v3 → v4 Migration

Main improvement: **100x faster TypeScript compilation**

```ts
// v3: slow compilation due to deep type instantiation
export const a = z.object({ a: z.string(), b: z.string() });
export const b = a.omit({ a: true });
export const c = b.extend({ a: z.string() });
// ... repeating this 10 times caused 25,000+ instantiations

// v4: same code, 175 instantiations — 100x faster
```

No API changes; migration is usually drop-in.

### Common Mistakes to Avoid

1. **Not using `.safeParse()` for untrusted data**
   - `.parse()` throws; use `.safeParse()` to check result
   - Especially important for API inputs

2. **Overly permissive schemas**
   - Bad: `z.object({ ...}).passthrough()`
   - Good: `.strict()` to reject unknown fields

3. **Not inferring types**
   - Always: `type User = z.infer<typeof UserSchema>`
   - Keeps types and validation in sync

4. **Forgetting async validation in forms**
   - Can validate username uniqueness, etc.
   - Use `onSubmitAsync` in TanStack Form

### Performance Best Practices

1. **Pre-define and reuse schemas**
   - Don't create schemas inside functions
   - Define once, import everywhere

2. **Use `.memoize()` for complex validations**
   - Reduces redundant schema creation

3. **Order validations from fast to slow**
   - Type checks first, then async server validation

4. **Type inference is free**
   - Always use `z.infer<typeof Schema>`
   - No runtime overhead

### TypeScript Usage

```ts
// Strongly typed server action
'use server';

import { CreateCardSchema } from '@/lib/schemas';

export async function createCard(
  formData: z.infer<typeof CreateCardSchema>
): Promise<{ success: boolean; cardId?: string; error?: string }> {
  const parsed = CreateCardSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: 'Invalid data' };
  }

  const card = await createCardOnChain(parsed.data);
  return { success: true, cardId: card.objectId };
}
```

---

## @t3-oss/env-nextjs

### Version
- **Current**: 0.13.11
- **Purpose**: Type-safe environment variable schema with build-time validation

### Setup (Suiki Pattern)

```ts
// src/env.ts — validated at build time
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  // Variables available ONLY on server
  server: {
    SPONSOR_PRIVATE_KEY: z.string().min(1),
  },

  // Variables available on BOTH server and client (must start with NEXT_PUBLIC_)
  client: {
    NEXT_PUBLIC_SUI_NETWORK: z.enum(['mainnet', 'testnet', 'devnet']),
    NEXT_PUBLIC_PACKAGE_ID: z.string().min(1),
  },

  // Explicit mapping for Next.js >= 13.4.4
  runtimeEnv: {
    SPONSOR_PRIVATE_KEY: process.env.SPONSOR_PRIVATE_KEY,
    NEXT_PUBLIC_SUI_NETWORK: process.env.NEXT_PUBLIC_SUI_NETWORK,
    NEXT_PUBLIC_PACKAGE_ID: process.env.NEXT_PUBLIC_PACKAGE_ID,
  },

  emptyStringAsUndefined: true, // Treat empty string as undefined
});
```

### next.config.ts — Build-Time Validation

```ts
// next.config.ts — must come FIRST
import "./src/env.ts"; // validate env at build time

import withPWAInit from "@ducanh2912/next-pwa";

// ... rest of config
```

Errors at build time if env vars are missing or invalid.

### Server-Side Usage

```ts
// src/lib/sui-client.ts
import { env } from '@/env';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const GRPC_URLS = {
  testnet: 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
} as const;

export const suiClient = new SuiGrpcClient({
  network: env.NEXT_PUBLIC_SUI_NETWORK,
  baseUrl: GRPC_URLS[env.NEXT_PUBLIC_SUI_NETWORK],
});

// sponsorKeypair uses SPONSOR_PRIVATE_KEY (server only)
```

### Client-Side Usage

```tsx
// app/page.tsx — Client Component can only access NEXT_PUBLIC_*
'use client';

import { env } from '@/env';

export function PackageInfo() {
  return (
    <div>
      {/* OK: NEXT_PUBLIC_PACKAGE_ID is accessible */}
      <p>Package: {env.NEXT_PUBLIC_PACKAGE_ID}</p>

      {/* COMPILE ERROR: SPONSOR_PRIVATE_KEY not exported to client */}
      {/* <p>{env.SPONSOR_PRIVATE_KEY}</p> */}
    </div>
  );
}
```

### Env File Example (.env.local)

```bash
# Private (server only)
SPONSOR_PRIVATE_KEY=0x...

# Public (shared with client, NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_PACKAGE_ID=0x...
```

### Common Mistakes to Avoid

1. **Putting `import './env.ts'` anywhere but first in next.config.ts**
   - Must be first line so validation runs at build time

2. **Using server vars on client**
   - TypeScript error if not prefixed with NEXT_PUBLIC_
   - This is a security feature

3. **Not setting `emptyStringAsUndefined: true`**
   - Empty env vars should be undefined, not `""`
   - Fixes TypeScript undefined handling

4. **Forgetting `runtimeEnv` mapping**
   - Required for `@t3-oss/env-nextjs`
   - Links schema to actual process.env

### Performance Best Practices

1. **Validate at build time**
   - Errors caught before deployment
   - No runtime overhead

2. **Keep env schema in one file**
   - Import from `@/env` everywhere
   - Single source of truth

3. **Use enums for known values**
   ```ts
   NEXT_PUBLIC_SUI_NETWORK: z.enum(['mainnet', 'testnet', 'devnet'])
   ```
   - Autocomplete support

### TypeScript Usage

```ts
// Full type safety
import { env } from '@/env';

// These are typed
const network: 'mainnet' | 'testnet' | 'devnet' = env.NEXT_PUBLIC_SUI_NETWORK;
const packageId: string = env.NEXT_PUBLIC_PACKAGE_ID;

// This causes compile error (server var not exported)
// const key: string = env.SPONSOR_PRIVATE_KEY; // ❌ Type error

// Server-side (can access private vars)
import { env } from '@/env';

const privateKey: string = env.SPONSOR_PRIVATE_KEY; // ✓ OK in server code
```

---

## @ducanh2912/next-pwa

### Version
- **Current**: 10.2.9
- **Purpose**: Offline-capable Progressive Web App for mobile

### Configuration (Suiki Pattern)

```ts
// next.config.ts
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public", // Output directory
  disable: process.env.NODE_ENV === "development", // Disabled in dev
  register: true, // Auto-register service worker
});

export default withPWA({
  reactStrictMode: true,
  turbopack: {},
  // ... rest of config
});
```

### Metadata and Manifest

```tsx
// app/layout.tsx
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Suiki",
  description: "Loyalty cards on Sui",
  manifest: "/manifest.json", // PWA manifest
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Suiki",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // Prevent zoom on input (PWA best practice)
  userScalable: false,
  themeColor: "#3b82f6",
};
```

### Public Manifest (manifest.json)

```json
{
  "name": "Suiki — Loyalty on Sui",
  "short_name": "Suiki",
  "description": "Merchant loyalty stamp cards powered by Sui blockchain",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#0f172a",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### Offline Fallback

```ts
// next.config.ts
const withPWA = withPWAInit({
  dest: "public",
  fallbacks: {
    document: "/offline", // Show this page when offline
    image: "/offline-image.png",
  },
});
```

```tsx
// app/offline/page.tsx
export default function OfflinePage() {
  return (
    <div>
      <h1>You are offline</h1>
      <p>Some features require an internet connection.</p>
    </div>
  );
}
```

### Caching Strategy

By default, next-pwa caches:
- HTML pages (on demand)
- CSS, JS, fonts
- Images

Customize with `workboxOptions`:

```ts
const withPWA = withPWAInit({
  dest: "public",
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fullnode\.sui\.io\/.*/,
        handler: 'NetworkFirst', // Try network first, fallback to cache
        options: {
          cacheName: 'sui-rpc-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60, // 1 hour
          },
        },
      },
    ],
  },
});
```

### Common Mistakes to Avoid

1. **Not disabling PWA in development**
   - Service workers persist during dev, breaking HMR
   - Always: `disable: process.env.NODE_ENV === "development"`

2. **Forgetting manifest.json in public/**
   - PWA won't install without it
   - Must reference in metadata

3. **Not testing on real device**
   - PWA behavior differs on mobile vs desktop
   - Test with `pnpm build && pnpm start`

4. **Caching API responses too aggressively**
   - Stale data on next launch
   - Use `NetworkFirst` for live data

### Performance Best Practices

1. **Use `maskable` icons**
   - Icons adapt to different device shapes
   - Include in manifest with `purpose: "maskable"`

2. **Precache critical resources**
   ```ts
   fallbacks: {
     document: "/offline",
   }
   ```
   - Ensures offline page is always available

3. **Keep service worker small**
   - ~50KB gzipped is typical
   - Workbox bundles only needed strategies

4. **Test offline mode**
   - DevTools → Network → Offline
   - Verify fallback page loads

### TypeScript Usage

```ts
// Type PWA config
import type { PWAConfig } from "@ducanh2912/next-pwa";

const pwaConfig: PWAConfig = {
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/api\./,
        handler: 'NetworkFirst',
      },
    ],
  },
};
```

---

## QR Code Libraries

### qrcode.react v4.2.0

**Use case**: Generate and display QR codes (e.g., stamp card invite links)

#### Basic Usage

```tsx
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';

export function ProgramQRCode({ programId }: { programId: string }) {
  const inviteUrl = `${BASE_URL}/join/${programId}`;

  return (
    <QRCodeSVG
      value={inviteUrl}
      size={256}
      level="H" // High error correction
      includeMargin
      bgColor="#0f172a" // Matches Suiki dark bg
      fgColor="#3b82f6" // Matches primary color
      title="Scan to join program"
    />
  );
}
```

#### Props Reference

```ts
interface QRProps {
  value: string | string[];           // URL or data to encode
  size?: number;                       // Pixels (default: 128)
  level?: 'L' | 'M' | 'Q' | 'H';      // Error correction (default: L)
  includeMargin?: boolean;             // Add quiet zone (default: false)
  marginSize?: number;                 // Quiet zone size in modules
  bgColor?: string;                    // CSS color
  fgColor?: string;                    // CSS color
  title?: string;                      // SVG title (accessibility)
  minVersion?: number;                 // 1-40
  boostLevel?: boolean;               // Auto-increase error correction
  imageSettings?: {                    // Embed logo
    src: string;
    width: number;
    height: number;
    excavate: boolean; // Clear area around logo
    x?: number;
    y?: number;
    opacity?: number;
  };
}
```

#### Common Patterns

```tsx
// Canvas (good for export/download)
<QRCodeCanvas
  value="https://example.com"
  size={512}
  level="H"
  ref={canvasRef}
/>

// SVG (scalable, clean in HTML)
<QRCodeSVG
  value="https://example.com"
  size={256}
/>

// With logo
<QRCodeSVG
  value={programInviteUrl}
  imageSettings={{
    src: '/suiki-logo.png',
    width: 40,
    height: 40,
    excavate: true,
  }}
/>
```

#### Performance Notes

- SVG is smaller for simple codes (~2KB)
- Canvas is faster for large size/logos
- Keep `size` reasonable (256-512px max)
- Error level 'H' (high) adds ~30% more data

---

### html5-qrcode v2.3.8

**Use case**: Scan QR codes with device camera (customer joining program)

#### Basic Scanner

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export function QRScanner({
  onScanSuccess,
}: {
  onScanSuccess: (result: string) => void;
}) {
  const ref = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader');
    ref.current = scanner;

    Html5Qrcode.getCameras()
      .then((cameras) => {
        if (cameras.length === 0) {
          console.error('No cameras found');
          return;
        }

        const cameraId = cameras[0].id;
        scanner
          .start(
            cameraId,
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
              onScanSuccess(decodedText);
              // Optionally: scanner.stop();
            },
            (error) => {
              // Ignore scan errors (user hasn't pointed at code yet)
              // console.warn(`QR scan error: ${error}`);
            }
          )
          .catch((err) => {
            console.error('Camera error:', err);
          });
      })
      .catch((err) => {
        console.error('Camera permission denied:', err);
      });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, []);

  return (
    <div>
      <div id="qr-reader" style={{ width: '100%' }} />
    </div>
  );
}
```

#### Advanced Configuration

```ts
const config = {
  fps: 10,                              // Frames per second
  qrbox: { width: 250, height: 250 },  // Scanning region
  aspectRatio: 16 / 9,                 // Camera feed ratio
  disableFlip: false,                  // Scan flipped codes
  videoConstraints: {
    facingMode: 'environment',          // Back camera on mobile
  },
};

scanner.start(cameraId, config, onSuccess, onError);
```

#### Common Patterns

```tsx
// Form integration
import { useForm } from '@tanstack/react-form';

export function JoinProgramForm() {
  const form = useForm({
    defaultValues: { inviteCode: '' },
    onSubmit: async ({ value }) => {
      const program = await joinProgram(value.inviteCode);
    },
  });

  return (
    <>
      <QRScanner
        onScanSuccess={(code) => {
          // Parse program ID from scanned URL
          const programId = new URL(code).pathname.split('/').pop();
          form.setFieldValue('inviteCode', programId ?? '');
        }}
      />

      <form onSubmit={(e) => { e.preventDefault(); void form.handleSubmit(); }}>
        <input
          value={form.values.inviteCode}
          onChange={(e) => form.setFieldValue('inviteCode', e.target.value)}
          placeholder="Or enter code manually"
        />
        <button type="submit">Join Program</button>
      </form>
    </>
  );
}
```

#### Permission Handling

```tsx
// Check permission before showing scanner
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const cameras = await Html5Qrcode.getCameras();
    return cameras.length > 0;
  } catch (error) {
    return false;
  }
}

// In component
if (!hasPermission) {
  return <p>Camera permission required to scan. Enable in settings.</p>;
}
```

#### Performance Notes

- `fps: 10` is reasonable for battery life
- Higher `fps` = more CPU usage
- `qrbox` optional but improves UX
- `disableFlip: false` adds minimal overhead

---

### beautiful-qr-code (npm: mblode/beautiful-qr-code)

**Use case**: Generate beautiful, styled QR codes (alternative to qrcode.react)

This package creates QR codes with gradient backgrounds and custom styling.

#### Basic Usage

```tsx
import { createQRCode } from 'beautiful-qr-code';

export function StyledQRCode({ url }: { url: string }) {
  const canvas = createQRCode({
    text: url,
    width: 300,
    margin: 10,
    colorLight: '#0f172a',  // Dark bg
    colorDark: '#3b82f6',   // Blue code
    // logo?: string,
  });

  return <canvas />;
}
```

**Note**: Suiki currently uses `qrcode.react`. `beautiful-qr-code` is a future alternative if styled QR codes are needed.

---

## Lucide React Icons

### Version
- **Current**: Latest (1000+ icons)
- **Key Feature**: Tree-shakeable, only imported icons ship to client

### Basic Usage

```tsx
import { Camera, QrCode, Award, LogOut } from 'lucide-react';

export function Header() {
  return (
    <div className="flex gap-4">
      <Camera size={24} className="text-[--color-primary]" />
      <QrCode size={24} />
      <Award size={24} className="text-[--color-accent-loyalty]" />
      <LogOut size={24} />
    </div>
  );
}
```

### Props

```ts
interface IconProps {
  size?: number;              // Default: 24
  width?: number;
  height?: number;
  strokeWidth?: number;       // Default: 2
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
```

### Styling with Tailwind

```tsx
// Size variants
<Camera size={16} />  {/* Small */}
<Camera size={24} />  {/* Medium (default) */}
<Camera size={32} />  {/* Large */}

// Colors
<Camera className="text-[--color-primary]" />
<Camera className="text-[--color-success]" />
<Camera className="text-[--color-error]" />

// Combined
<Award className="text-[--color-accent-loyalty] w-8 h-8" />
```

### Dynamic Icons

```tsx
import * as Icons from 'lucide-react';

export function DynamicIcon({
  name,
  size = 24,
}: {
  name: keyof typeof Icons;
  size?: number;
}) {
  const Icon = Icons[name];
  if (!Icon) return null;
  return <Icon size={size} />;
}

// Usage
<DynamicIcon name="Camera" size={32} />
```

### Tree-Shaking

Lucide is fully tree-shakeable. Only imported icons ship to client:

```tsx
// Good (1 icon)
import { Camera } from 'lucide-react';

// Bad (all 1000+ icons)
import * as Icons from 'lucide-react';
const { Camera } = Icons;

// Also bad
import Icons from 'lucide-react';
const { Camera } = Icons;
```

### Common Patterns

```tsx
// Interactive icon button
export function IconButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-[--radius-base] hover:bg-[--color-bg-surface]"
      title={label}
    >
      <Icon size={20} className="text-[--color-text-secondary]" />
    </button>
  );
}

// Icon with label
export function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={24} className="text-[--color-accent-loyalty]" />
      <div>
        <p className="text-[--color-text-secondary]">{label}</p>
        <p className="text-[--color-text-primary] font-bold">{value}</p>
      </div>
    </div>
  );
}
```

### Performance Best Practices

1. **Import only used icons**
   - Tree-shaking removes unused imports
   - Check bundle size with `npm run build`

2. **Use consistent icon sizes**
   - Avoid `size={23}`, use `size={24}` or `size={32}`
   - Better rendering

3. **Memoize icon components**
   ```tsx
   const CameraIcon = memo(() => <Camera size={24} />);
   ```
   - Prevents re-renders in lists

4. **Icon libraries in constants**
   ```ts
   // lib/icons.ts
   import { Camera, QrCode, Award } from 'lucide-react';

   export const APP_ICONS = {
     camera: Camera,
     qrcode: QrCode,
     award: Award,
   } as const;
   ```

---

## Vitest

### Version
- **Current**: 4.1.1
- **Component Testing**: `*.test.tsx` excluded until jsdom added (see CLAUDE.md)

### Running Tests

```bash
pnpm test              # Run once
pnpm test:watch       # Watch mode
pnpm vitest run src/lib/__tests__/queries.test.ts  # Single file
```

### Test File Example

```ts
// src/lib/__tests__/queries.test.ts
import { describe, it, expect } from 'vitest';
import { getProgramsByMerchant } from '../queries';

describe('queries', () => {
  it('should parse StampProgram from object', async () => {
    // Test setup
    const merchantAddr = '0x123';

    // Execute
    const programs = await getProgramsByMerchant(merchantAddr);

    // Assert
    expect(programs).toBeDefined();
    expect(programs.length).toBeGreaterThanOrEqual(0);
  });
});
```

### Mocking

```ts
import { describe, it, expect, vi } from 'vitest';
import { awardStamp } from '../transactions';

describe('transactions', () => {
  it('should build award stamp transaction', () => {
    // Setup
    const mockTx = {
      moveCall: vi.fn(),
    };

    // Execute
    awardStamp(mockTx as any, 'programId', 'customerId');

    // Assert
    expect(mockTx.moveCall).toHaveBeenCalledOnce();
  });
});
```

### Coverage

```bash
pnpm vitest run --coverage
```

### Common Patterns

**Testing async functions:**
```ts
it('should fetch program', async () => {
  const program = await getProgramById('programId');
  expect(program).not.toBeNull();
});
```

**Testing error cases:**
```ts
it('should handle invalid program ID', async () => {
  const result = await getProgramById('invalid');
  expect(result).toBeNull();
});
```

### TypeScript Usage

```ts
import { describe, it, expect, vi, Mock } from 'vitest';

describe('types', () => {
  it('should type correctly', () => {
    const spy: Mock<(x: string) => void> = vi.fn();
    spy('test');
    expect(spy).toHaveBeenCalledWith('test');
  });
});
```

---

## Summary: Best Practices Checklist

### Architecture
- [ ] Server Components by default (`app/layout.tsx`)
- [ ] Extract client components to separate files (`app/providers.tsx`, `app/site-header.tsx`)
- [ ] Use `SuiGrpcClient` singleton in `src/lib/sui-client.ts`
- [ ] Centralize environment variables in `src/env.ts` with `@t3-oss/env-nextjs`

### Data Fetching
- [ ] Prefetch data on server, hydrate with `HydrationBoundary`
- [ ] Use `useSuspenseQuery` with `<Suspense>` boundaries
- [ ] Batch `getObjects()` calls, never loop with `getObject()`
- [ ] Set appropriate `staleTime` in QueryClient (60s for Sui data)

### Forms
- [ ] Use TanStack Form + Zod for validation
- [ ] Server-side validation with `onSubmitAsync`
- [ ] Subscribe to form state to avoid re-renders
- [ ] Server Actions for secure operations (sponsor tx, etc.)

### Styling
- [ ] Define all tokens in CSS custom properties (`:root`)
- [ ] Expose tokens to `@theme` for Tailwind utilities
- [ ] Use `className="text-[--color-primary]"` for design system colors
- [ ] Never create `tailwind.config.js` (v4 is CSS-first)

### Blockchain
- [ ] Use dApp Kit v2 for wallet connection
- [ ] Build transactions on client, sign via wallet
- [ ] Use React 19 Server Actions for sponsorship logic
- [ ] Always await async Sui operations

### Performance
- [ ] Tree-shake Lucide icons (only import what you use)
- [ ] Keep `'use client'` scope minimal
- [ ] Batch database/RPC calls
- [ ] Validate env vars at build time (@t3-oss/env-nextjs)

### Testing
- [ ] Test lib functions with Vitest (`.test.ts` files)
- [ ] Component tests await jsdom setup
- [ ] Mock external dependencies with `vi.fn()`

### Security
- [ ] Never expose `SPONSOR_PRIVATE_KEY` to client
- [ ] Use Server Actions for privileged operations
- [ ] Validate user input with Zod schemas
- [ ] Enforce `NEXT_PUBLIC_` prefix for client-side vars

---

**End of Research Document**

For the latest versions and docs, consult:
- Next.js: https://nextjs.org/docs
- React: https://react.dev
- Tailwind: https://tailwindcss.com/docs
- TanStack: https://tanstack.com
- Sui SDK: https://sdk.mystenlabs.com
- Zod: https://zod.dev
- Lucide: https://lucide.dev
