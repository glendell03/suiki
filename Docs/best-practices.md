# Production-Grade Best Practices Guide

Comprehensive best practices for Suiki's tech stack. This document covers breaking changes, performance optimizations, common pitfalls, and production patterns for each major package.

**Last Updated:** March 2026
**Stack Version:** Next.js 16.2.1, React 19.2.4, TypeScript 5+, TailwindCSS 4, Vitest 4.1.1

---

## 1. Next.js 16 App Router

### Breaking Changes from Next.js 15

#### Partial Prerendering (PPR) Config Migration
- **Next.js 15 (Deprecated):**
  ```javascript
  module.exports = {
    experimental: {
      dynamicIO: true,
    },
  }
  ```
- **Next.js 16 (Current):**
  ```javascript
  module.exports = {
    cacheComponents: true,
  }
  ```
- **Impact:** Remove `experimental_ppr` route segment config. The new `cacheComponents` approach operates differently—test thoroughly.

#### CSS Import Changes
- `@tailwind` directives are replaced with standard CSS imports
- See Tailwind CSS v4 section for migration details

### Server vs Client Components

**Server Components (Default)**
- Use by default—no `'use client'` directive needed
- Execute only on server, never sent to client bundle
- Direct database access, environment variables, API tokens
- Can pass promises directly to client components
- Cannot use browser APIs, hooks, or event listeners

**Client Components**
- Mark with `'use client'` at top of file
- Sent to browser and rendered client-side
- Can use React hooks, browser APIs, event listeners
- Cannot access server-side secrets directly

**Best Practice Pattern:**
```typescript
// app/dashboard/page.tsx (Server Component)
import { fetchUserData } from '@/lib/server-api'
import { UserDashboard } from './user-dashboard'

export default async function DashboardPage() {
  const userData = await fetchUserData() // Direct DB call on server
  return <UserDashboard initialData={userData} />
}
```

```typescript
// app/dashboard/user-dashboard.tsx (Client Component)
'use client'

import { useState } from 'react'

export function UserDashboard({ initialData }) {
  const [data, setData] = useState(initialData)
  // Interactive state management
}
```

### Streaming and Suspense Integration

Next.js 16 uses React's Suspense boundaries for streaming. HTML chunks are sent progressively:

```typescript
import { Suspense } from 'react'
import { BlogPostList } from './blog-posts'
import { UserPreferences } from './user-prefs'

export default function BlogPage() {
  return (
    <div>
      <header>Latest Blog</header>

      {/* First batch: renders immediately */}
      <Suspense fallback={<div>Loading posts...</div>}>
        <BlogPostList />
      </Suspense>

      {/* Second batch: streams after first completes */}
      <Suspense fallback={<div>Loading preferences...</div>}>
        <UserPreferences />
      </Suspense>
    </div>
  )
}
```

**Key Benefits:**
- Multiple Suspense boundaries stream independently
- Users see UI progressively (faster FCP)
- Slower components don't block faster ones

### Cache Directives: `use cache`

Next.js 16 introduces `'use cache'` for component-level caching:

```typescript
async function CachedBlogPosts() {
  'use cache'
  cacheLife('hours')
  cacheTag('blog-posts')

  const posts = await fetch('https://api.example.com/posts', {
    cache: 'no-store' // Bypass HTTP cache
  })

  return <BlogList posts={posts} />
}
```

**Directives:**
- `'use cache'` - Enable caching for this component
- `cacheLife()` - How long to cache: `'seconds'`, `'minutes'`, `'hours'`, `'days'`
- `cacheTag()` - Label for cache invalidation via `updateTag()`

**Revalidate Cached Content:**
```typescript
async function CreatePost(formData: FormData) {
  'use server'

  await db.post.create({ title: formData.get('title') })
  updateTag('blog-posts') // Invalidate cache
}
```

### Server Actions

Server Actions are async functions that run on the server. Always validate input and handle errors:

```typescript
// app/actions.ts
'use server'

import { z } from 'zod'

const postSchema = z.object({
  title: z.string().min(5),
  content: z.string().min(10),
})

export async function createPost(formData: FormData) {
  try {
    const data = postSchema.parse({
      title: formData.get('title'),
      content: formData.get('content'),
    })

    const result = await db.post.create(data)
    revalidatePath('/posts')
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
```

**Key Points:**
- Always validate input with Zod
- Use `revalidatePath()` or `revalidateTag()` for cache invalidation
- Return structured responses (avoid throwing in production)
- Error handling matters for mobile clients (slower networks)

### Dynamic Routes and Params

```typescript
// app/posts/[slug]/page.tsx
export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // params is now a Promise in Next.js 16
  const { slug } = await params
  const { sort } = await searchParams

  const post = await db.post.findBySlug(slug)
  return <PostDetail post={post} sortBy={sort} />
}
```

**Note:** `params` and `searchParams` are Promises in Next.js 16 for better streaming.

---

## 2. React 19

### New Hooks

#### `useOptimistic`
Immediately update UI while async action completes:

```typescript
'use client'

import { useOptimistic, startTransition } from 'react'
import { likePost } from '@/app/actions'

export function LikeButton({ postId, isLiked: initialIsLiked }) {
  const [optimisticIsLiked, setOptimisticIsLiked] = useOptimistic(initialIsLiked)

  function handleLike() {
    startTransition(async () => {
      setOptimisticIsLiked(!optimisticIsLiked)
      const result = await likePost(postId, !optimisticIsLiked)

      if (!result.success) {
        // Revert on error (useOptimistic handles this)
        setOptimisticIsLiked(initialIsLiked)
      }
    })
  }

  return (
    <button onClick={handleLike} disabled={optimisticIsLiked === initialIsLiked}>
      {optimisticIsLiked ? '❤️' : '🤍'} Like
    </button>
  )
}
```

**Anti-Pattern:** Don't use for destructive operations without confirmation.

#### `use()` for Promises and Context
Access promises and context in components:

```typescript
'use client'

import { use } from 'react'

export function UserData({ userPromise }: { userPromise: Promise<User> }) {
  // use() unwraps the promise
  const user = use(userPromise)

  return <div>{user.name}</div>
}

// Can pass directly from Server Component
export async function Page() {
  const userPromise = fetchUser()
  return <UserData userPromise={userPromise} />
}
```

#### `useTransition` for Pending States
Manage async operation state in client components:

```typescript
'use client'

import { useTransition } from 'react'

export function SubmitButton({ onSubmit }) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    startTransition(async () => {
      await onSubmit()
    })
  }

  return (
    <button onClick={handleSubmit} disabled={isPending}>
      {isPending ? 'Submitting...' : 'Submit'}
    </button>
  )
}
```

### Form Actions in `<form action>`
React 19 supports server actions directly in form elements:

```typescript
'use client'

import { updateName } from '@/app/actions'
import { useActionState } from 'react'

export function NameForm({ currentName }) {
  const [state, formAction, isPending] = useActionState(
    async (prevState, formData) => {
      const result = await updateName(formData.get('name'))
      return result
    },
    { success: false }
  )

  return (
    <form action={formAction}>
      <input name="name" defaultValue={currentName} disabled={isPending} />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>
      {state?.error && <span className="error">{state.error}</span>}
    </form>
  )
}
```

### Server Components as Props
Pass Server Components as props to Client Components:

```typescript
'use client'

export function ClientWrapper({ children }) {
  return <div className="wrapper">{children}</div>
}

// Usage in Server Component
export default async function Page() {
  const serverData = await fetchData()
  return (
    <ClientWrapper>
      <ServerDataDisplay data={serverData} />
    </ClientWrapper>
  )
}
```

---

## 3. TypeScript 5

### `satisfies` Operator
Validate structure without narrowing type:

```typescript
type RGB = [number, number, number]
type ColorPalette = Record<string, string | RGB>

const palette = {
  red: [255, 0, 0],
  green: '#00ff00',
  blue: [0, 0, 255],
  // typo: [0, 0] // ❌ Error caught here
} satisfies ColorPalette

// Type info preserved for inference
const greenColor = palette.green.toUpperCase() // ✅ toUpperCase available
```

**Use Case:** Config objects, API responses that must match a contract but preserve literal types.

### `const` Type Parameters
Infer literal types instead of widening:

```typescript
type HasNames = { names: readonly string[] }

function getNamesExactly<const T extends HasNames>(arg: T): T['names'] {
  return arg.names
}

// Inferred: readonly ["Alice", "Bob"]
// Without 'const', would be: string[]
const names = getNamesExactly({ names: ['Alice', 'Bob'] })

// Useful for generic functions that need to preserve literal values
```

### Performance Tips

**1. Incremental Type Checking**
```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```
- Builds cache for faster subsequent checks
- Essential for large projects

**2. Skip Lib Check**
```json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```
- Skip type-checking of `.d.ts` files
- Safe for production, speeds up build significantly

**3. Isolate Declarations**
```json
{
  "compilerOptions": {
    "isolatedDeclarations": true
  }
}
```
- Each file emitted independently
- Enables parallel type checking

---

## 4. Tailwind CSS v4

### Major Breaking Changes

#### CSS-First Configuration
**v3 (Deprecated):**
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        'brand-blue': '#1e40af',
      },
    },
  },
}
```

**v4 (Current):** No `tailwind.config.js`. Use `@import` and `@theme`:
```css
@import "tailwindcss";

@theme {
  --font-family-sans: "Geist Sans", sans-serif;
  --color-brand-blue: #1e40af;
  --breakpoint-3xl: 120rem;
  --shadow-lg: 0 20px 25px -5px rgb(0 0 0 / 0.1);
}
```

**Key Benefit:** CSS variables are now first-class. No JavaScript config parsing.

#### Import Statement Changes
**v3:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**v4:**
```css
@import "tailwindcss";
```

**Single import replaces all three directives.**

#### Use CSS Variables Instead of theme() Function
**v3:**
```css
.my-button {
  background-color: theme('colors.blue.500');
}
```

**v4:**
```css
.my-button {
  background-color: var(--color-blue-500);
}

/* Only use theme() in media queries */
@media (width >= theme(--breakpoint-lg)) {
  /* ... */
}
```

### Using @theme Directive
```css
@import "tailwindcss";

@theme {
  /* Define all custom tokens as CSS variables */
  --color-primary: oklch(64% 0.1 259); /* OKLCH is modern and accessible */
  --color-secondary: oklch(60% 0.08 240);
  --color-success: oklch(70% 0.15 142);
  --color-error: oklch(55% 0.2 25);

  --font-heading: "Inter", sans-serif;
  --font-body: "Inter", sans-serif;

  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;

  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);

  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
}
```

### Color Spaces in v4
Prefer OKLCH over HEX for better perceptual uniformity:

```css
@theme {
  /* Good: OKLCH respects human perception */
  --color-blue-400: oklch(73% 0.14 259);
  --color-blue-500: oklch(64% 0.1 259);
  --color-blue-600: oklch(51% 0.08 259);

  /* Alternative: HSL (decent) */
  --color-red-500: hsl(0 100% 50%);
}
```

**Benefit:** Colors feel more consistent across lightness levels.

### Using @reference for Scoped Stylesheets
In Vue, Svelte, or CSS Modules where theme variables don't auto-import:

```vue
<template>
  <h1>Hello</h1>
</template>

<style scoped>
  @reference "../../app.css";

  h1 {
    color: var(--color-blue-500);
  }
</style>
```

---

## 5. React Query (TanStack Query) v5

### Major API Changes from v4

#### `useSuspenseQuery` for Streaming SSR
Replaces `useQuery` when using Suspense:

```typescript
'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { Suspense } from 'react'

function Posts() {
  // No status, no error—Suspense handles it
  const { data } = useSuspenseQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const res = await fetch('/api/posts')
      return res.json()
    },
  })

  return (
    <ul>
      {data.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading posts...</div>}>
      <Posts />
    </Suspense>
  )
}
```

**In Suspense Mode:**
- No `status` field (Suspense handles 'pending')
- No `error` field (Error Boundary handles errors)
- Use `ErrorBoundary` to catch errors
- Data is guaranteed defined

#### Infinite Queries with Suspense
```typescript
import { useSuspenseInfiniteQuery } from '@tanstack/react-query'

function InfinitePostList() {
  const { data, fetchNextPage, hasNextPage } = useSuspenseInfiniteQuery({
    queryKey: ['posts'],
    queryFn: async ({ pageParam }) => {
      const res = await fetch(`/api/posts?page=${pageParam}`)
      return res.json()
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextPage : undefined,
  })

  return (
    <>
      {data.pages.map(page =>
        page.items.map(post => <PostCard key={post.id} post={post} />)
      )}
      <button
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage}
      >
        Load More
      </button>
    </>
  )
}
```

### Pending Query Dehydration (Streaming)
Kick off queries without blocking render:

```typescript
// app/posts/page.tsx (Server Component)
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { PostList } from './post-list'

export default async function PostsPage() {
  const queryClient = new QueryClient()

  // Start fetching but don't await—streams result
  queryClient.prefetchQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const res = await fetch('https://api.example.com/posts')
      return res.json()
    },
  })

  // Page streams immediately with pending query
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PostList />
    </HydrationBoundary>
  )
}
```

**Benefit:** First page of data doesn't block page render.

### Server-Side Rendering Best Practices

```typescript
// lib/query-client.ts
import { QueryClient, defaultShouldDehydrateQuery } from '@tanstack/react-query'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Don't refetch on component mount in SSR
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes (was cacheTime)
      },
      dehydrate: {
        // Only dehydrate successful queries
        shouldDehydrateQuery: query =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
      },
    },
  })
}
```

### Mutation Pattern with useTransition
```typescript
'use client'

import { useMutation } from '@tanstack/react-query'
import { useTransition } from 'react'

export function CreatePostForm() {
  const [isPending, startTransition] = useTransition()
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.json()
    },
  })

  function handleSubmit(formData) {
    startTransition(() => {
      createMutation.mutate({
        title: formData.get('title'),
      })
    })
  }

  return (
    <form>
      <button disabled={isPending || createMutation.isPending}>
        Create
      </button>
    </form>
  )
}
```

---

## 6. TanStack Form v1

### Basic Setup with Zod

```typescript
'use client'

import { useForm } from '@tanstack/react-form'
import { z } from 'zod'

const userSchema = z.object({
  firstName: z.string().min(1, 'First name required'),
  lastName: z.string().min(1, 'Last name required'),
  email: z.string().email('Invalid email'),
})

export function UserForm() {
  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
    },
    validators: {
      onChange: userSchema,
    },
    onSubmit: async ({ value }) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(value),
      })
      return response.json()
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.Field
        name="firstName"
        children={(field) => (
          <>
            <label htmlFor={field.name}>First Name</label>
            <input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.length > 0 && (
              <div className="error">
                {field.state.meta.errors.join(', ')}
              </div>
            )}
          </>
        )}
      />

      <form.Field
        name="email"
        children={(field) => (
          <>
            <label htmlFor={field.name}>Email</label>
            <input
              id={field.name}
              type="email"
              name={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
              <div className="error">
                {field.state.meta.errors.join(', ')}
              </div>
            )}
          </>
        )}
      />

      <form.Subscribe
        selector={(state) => [state.isSubmitting, state.canSubmit]}
        children={([isSubmitting, canSubmit]) => (
          <button type="submit" disabled={isSubmitting || !canSubmit}>
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        )}
      />
    </form>
  )
}
```

### Async Field Validation
```typescript
const form = useForm({
  defaultValues: { email: '' },
  validators: {
    onChange: z.object({
      email: z.string().email(),
    }),
  },
})

return (
  <form.Field
    name="email"
    validators={{
      onChangeAsyncDebounceMs: 300,
      onChangeAsync: z.string().email().refine(
        async (email) => {
          const taken = await checkEmailTaken(email)
          return !taken
        },
        { message: 'Email already registered' }
      ),
    }}
    children={(field) => (
      <>
        <input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
        {field.state.meta.isValidating && <span>Checking...</span>}
        {field.state.meta.errors.length > 0 && (
          <div className="error">{field.state.meta.errors[0]}</div>
        )}
      </>
    )}
  />
)
```

### Server-Side Validation with onSubmitAsync
```typescript
const form = useForm({
  defaultValues: { username: '', password: '' },
  validators: {
    onSubmitAsync: async ({ value }) => {
      // Validate on server
      const response = await fetch('/api/validate-user', {
        method: 'POST',
        body: JSON.stringify(value),
      })
      const errors = await response.json()

      if (response.ok) return null

      return {
        fields: {
          username: errors.username || '',
          password: errors.password || '',
        },
      }
    },
  },
})
```

### Key Patterns

**1. Nested Object Fields:**
```typescript
<form.Field
  name="address.street"
  children={(field) => <input value={field.state.value} onChange={...} />}
/>
<form.Field
  name="address.city"
  children={(field) => <input value={field.state.value} onChange={...} />}
/>
```

**2. Dynamic Arrays:**
```typescript
<form.Field
  name="tags"
  children={(field) => (
    <>
      {field.state.value.map((tag, i) => (
        <input
          key={i}
          value={tag}
          onChange={(e) => {
            const newTags = [...field.state.value]
            newTags[i] = e.target.value
            field.handleChange(newTags)
          }}
        />
      ))}
    </>
  )}
/>
```

---

## 7. Zod v4

### Major Performance Improvements

**Benchmarks (Zod 4 vs Zod 3):**
- Object parsing: **6.5x faster**
- Array parsing: **7.43x faster**
- String parsing: **14x faster**
- Core bundle size: **50% smaller**
- TypeScript instantiations: **100x fewer**

### Breaking Changes

#### Removal of `ctx.path` in SuperRefine
**v3:**
```typescript
z.string().superRefine((val, ctx) => {
  console.log(ctx.path) // Available
})
```

**v4:**
```typescript
z.string().superRefine((val, ctx) => {
  // ❌ ctx.path no longer available
  // Use custom error messages instead
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Custom error message',
  })
})
```

### Best Practices

#### 1. Use `.refine()` for Custom Validation
```typescript
const userSchema = z.object({
  email: z.string().email(),
  passwordConfirm: z.string(),
  password: z.string().min(8),
}).refine((data) => data.password === data.passwordConfirm, {
  message: 'Passwords do not match',
  path: ['passwordConfirm'], // Field to attach error
})
```

#### 2. Use `.superRefine()` for Complex Logic
```typescript
const schema = z.object({
  birthDate: z.string().datetime(),
  age: z.number(),
}).superRefine((data, ctx) => {
  const birthDate = new Date(data.birthDate)
  const today = new Date()
  const calculatedAge = today.getFullYear() - birthDate.getFullYear()

  if (calculatedAge !== data.age) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['age'],
      message: `Age must be ${calculatedAge}`,
    })
  }
})
```

#### 3. Discriminated Unions for Multiple Types
```typescript
const eventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('submit'), formId: z.string() }),
  z.object({ type: z.literal('scroll'), direction: z.enum(['up', 'down']) }),
])

const event = eventSchema.parse(data)
// TypeScript knows exact shape based on event.type
```

#### 4. Coerce Types Explicitly
```typescript
// ✅ Explicit coercion
const schema = z.object({
  count: z.coerce.number(), // "5" → 5
  active: z.coerce.boolean(), // "true" → true
  date: z.coerce.date(), // "2024-01-01" → Date
})

// ❌ Don't implicitly coerce
const schema = z.object({
  count: z.number(), // "5" throws error
})
```

#### 5. Use `.readonly()` for Immutable Data
```typescript
const configSchema = z.object({
  apiKey: z.string(),
  baseUrl: z.string(),
}).readonly()

const config = configSchema.parse(data) as Readonly<typeof data>
```

---

## 8. html5-qrcode

### Proper Setup with Cleanup

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import Html5QrcodeScanner from 'html5-qrcode'
import type { Html5QrcodeResult } from 'html5-qrcode'

export function QRCodeScanner({ onScan }) {
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  useEffect(() => {
    // Create scanner instance
    scannerRef.current = new Html5QrcodeScanner('reader', {
      fps: 10,
      qrbox: { width: 300, height: 300 },
      rememberLastUsedCamera: true,
      showTorchButtonIfSupported: true,
    })

    // Start scanner
    scannerRef.current.render(
      (decodedText) => {
        onScan(decodedText)
      },
      (error) => {
        // Ignore errors from rapid scanning
        if (!error.includes('QR code not found')) {
          console.warn('QR error:', error)
        }
      }
    )

    setIsScanning(true)

    // Cleanup: critical for preventing camera leaks
    return () => {
      if (scannerRef.current?.getState() !== Html5QrcodeScanner.INACTIVE_STATE) {
        scannerRef.current?.pause(true)
        scannerRef.current?.clear()
      }
      scannerRef.current = null
    }
  }, [onScan])

  return <div id="reader" style={{ width: '300px', height: '300px' }} />
}
```

### Camera Permissions Handling
```typescript
export function QRCodeScannerWithPermissions() {
  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>('pending')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    navigator.permissions
      .query({ name: 'camera' })
      .then((result) => {
        if (result.state === 'granted') {
          setPermission('granted')
        } else if (result.state === 'denied') {
          setPermission('denied')
          setError('Camera permission denied. Enable in settings.')
        } else {
          setPermission('pending')
        }

        result.addEventListener('change', () => {
          setPermission(result.state === 'granted' ? 'granted' : 'denied')
        })
      })
      .catch(() => {
        // Fallback: Try to start scanner anyway
        setPermission('pending')
      })
  }, [])

  if (permission === 'denied') {
    return <div className="error">{error}</div>
  }

  if (permission === 'pending') {
    return <div>Requesting camera permission...</div>
  }

  return <QRCodeScanner onScan={handleScan} />
}
```

### Performance Optimization
```typescript
interface ScanResult {
  text: string
  timestamp: number
}

const DEBOUNCE_MS = 1000
let lastScannedTime = 0

export function OptimizedQRScanner({ onScan }) {
  const handleScan = (decodedText) => {
    const now = Date.now()

    // Prevent rapid duplicate scans
    if (now - lastScannedTime < DEBOUNCE_MS) return

    lastScannedTime = now
    onScan(decodedText)
  }

  return <QRCodeScanner onScan={handleScan} />
}
```

### Video Constraints (Zoom, Torch)
```typescript
export function AdvancedQRScanner() {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  const enableTorch = async () => {
    try {
      const capabilities = scannerRef.current?.getRunningTrackCapabilities()

      if (capabilities?.torch) {
        await scannerRef.current?.applyVideoConstraints({
          advanced: [{ torch: true }],
        })
      }
    } catch (error) {
      console.error('Failed to enable torch:', error)
    }
  }

  const setZoom = async (level: number) => {
    try {
      const capabilities = scannerRef.current?.getRunningTrackCapabilities()

      if (capabilities?.zoom) {
        await scannerRef.current?.applyVideoConstraints({
          zoom: level,
        })
      }
    } catch (error) {
      console.error('Failed to set zoom:', error)
    }
  }

  return (
    <>
      <div id="reader" />
      <button onClick={enableTorch}>Enable Torch</button>
      <button onClick={() => setZoom(2)}>2x Zoom</button>
    </>
  )
}
```

---

## 9. qrcode.react

### QRCodeSVG vs QRCodeCanvas

**QRCodeSVG (Recommended)**
- Vector format—scales infinitely
- Smaller file size for simple codes
- Better for printing
- CSS styling support
- No Canvas API dependency

```typescript
import QRCode from 'qrcode.react'

export function QRCodeSVG({ value }) {
  return (
    <QRCode
      value={value}
      size={256}
      level="H"
      includeMargin={true}
      fgColor="#000000"
      bgColor="#ffffff"
    />
  )
}
```

**QRCodeCanvas**
- Raster format—fixed resolution
- Larger file size
- Better performance for large/complex codes
- Can be saved as image easily
- Higher compatibility with older devices

```typescript
import QRCode from 'qrcode.react'

export function QRCodeCanvas({ value }) {
  return (
    <QRCode
      value={value}
      renderAs="canvas"
      size={256}
      level="H"
      includeMargin={true}
      fgColor="#000000"
      bgColor="#ffffff"
    />
  )
}
```

### Responsive QR Code
```typescript
export function ResponsiveQRCode({ value }) {
  const [size, setSize] = useState(256)

  useEffect(() => {
    const handleResize = () => {
      const width = Math.min(window.innerWidth * 0.8, 512)
      setSize(width)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="flex justify-center">
      <QRCode
        value={value}
        size={size}
        level="H"
        includeMargin={true}
      />
    </div>
  )
}
```

### Download QR Code
```typescript
const qrRef = useRef<HTMLCanvasElement>(null)

const downloadQR = () => {
  if (qrRef.current) {
    const canvas = qrRef.current.querySelector('canvas')
    if (canvas) {
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = 'qrcode.png'
      link.click()
    }
  }
}

return (
  <>
    <div ref={qrRef}>
      <QRCode
        value={value}
        renderAs="canvas"
        size={256}
      />
    </div>
    <button onClick={downloadQR}>Download</button>
  </>
)
```

### Error Correction Levels
```typescript
// Level determines how much damage QR can sustain
interface QRCodeProps {
  level?: 'L' | 'M' | 'Q' | 'H' // Default: 'L'
}

// L: 7% recovery
// M: 15% recovery
// Q: 25% recovery
// H: 30% recovery (recommended for critical codes)

<QRCode value={value} level="H" />
```

### Embedded Images
```typescript
import QRCode from 'qrcode.react'

export function QRCodeWithLogo({ value, logoUrl }) {
  return (
    <QRCode
      value={value}
      size={256}
      level="H"
      includeMargin={true}
      imageSettings={{
        src: logoUrl,
        x: undefined, // Centers horizontally
        y: undefined, // Centers vertically
        height: 60,
        width: 60,
        excavate: true, // Clear background for logo
      }}
    />
  )
}
```

---

## 10. @mysten/dapp-kit-react v2

### Setup with DAppKitProvider

```typescript
// app/layout.tsx
import { DAppKitProvider } from '@mysten/dapp-kit-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <QueryClientProvider client={queryClient}>
          <DAppKitProvider>
            {children}
          </DAppKitProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}
```

### Core Hooks

#### `useCurrentAccount()`
Get the connected wallet's account:

```typescript
'use client'

import { useCurrentAccount } from '@mysten/dapp-kit-react'

export function UserProfile() {
  const account = useCurrentAccount()

  if (!account) {
    return <div>No wallet connected</div>
  }

  return (
    <div>
      <p>Address: {account.address}</p>
      <p>Label: {account.label}</p>
    </div>
  )
}
```

#### `useDAppKit()`
Access dApp Kit methods:

```typescript
'use client'

import { useDAppKit } from '@mysten/dapp-kit-react'
import type { UiWallet } from '@mysten/dapp-kit-react'

export function ConnectWalletButton({ wallet }: { wallet: UiWallet }) {
  const dAppKit = useDAppKit()

  const handleConnect = async () => {
    try {
      await dAppKit.connectWallet({ wallet })
      console.log('Connected successfully')
    } catch (error) {
      console.error('Connection failed:', error)
    }
  }

  return <button onClick={handleConnect}>Connect {wallet.name}</button>
}
```

#### `useCurrentNetwork()`
Get the current network:

```typescript
'use client'

import { useCurrentNetwork } from '@mysten/dapp-kit-react'

export function NetworkDisplay() {
  const network = useCurrentNetwork()

  return <div>Network: {network}</div>
}
```

#### `useWalletConnection()`
Get detailed connection status:

```typescript
'use client'

import { useWalletConnection } from '@mysten/dapp-kit-react'

export function ConnectionStatus() {
  const connection = useWalletConnection()

  if (connection.status === 'disconnected') {
    return <div>Please connect your wallet</div>
  }

  if (connection.status === 'connecting') {
    return <div>Connecting...</div>
  }

  // status === 'connected'
  return (
    <div>
      <p>Wallet: {connection.wallet?.name}</p>
      <p>Address: {connection.account?.address}</p>
    </div>
  )
}
```

### Transaction Signing Pattern

```typescript
'use client'

import { useSuiClient } from '@mysten/dapp-kit-react'
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit-react'
import { Transaction } from '@mysten/sui/transactions'

export function SendTransaction() {
  const suiClient = useSuiClient()
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()

  const handleTransfer = async () => {
    const tx = new Transaction()

    tx.moveCall({
      target: '0x2::sui_system::request_add_stake',
      arguments: [/* ... */],
    })

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          console.log('Transaction successful:', result.digest)
        },
        onError: (error) => {
          console.error('Transaction failed:', error)
        },
      }
    )
  }

  return <button onClick={handleTransfer}>Send Transaction</button>
}
```

### Server-Side RPC Calls

**Important:** Never use `SuiClient` on the server. Use `SuiGrpcClient`:

```typescript
// lib/sui-client.ts
import { SuiGrpcClient } from '@mysten/sui/grpc'

export const suiClient = new SuiGrpcClient({
  url: process.env.NEXT_PUBLIC_SUI_RPC_URL || 'https://mainnet-rpc.sui.io',
})
```

```typescript
// app/api/balance/route.ts
import { suiClient } from '@/lib/sui-client'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')

  if (!address) {
    return Response.json({ error: 'Missing address' }, { status: 400 })
  }

  try {
    const balance = await suiClient.getBalance({
      owner: address,
    })
    return Response.json(balance)
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
```

---

## 11. Vitest v4

### React Component Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from 'vitest/browser'
import { MyComponent } from './my-component'

describe('MyComponent', () => {
  beforeEach(() => {
    // Setup before each test
  })

  it('renders text', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('handles click events', async () => {
    render(<MyComponent />)
    const button = screen.getByRole('button')

    await button.click()

    expect(screen.getByText('Clicked')).toBeInTheDocument()
  })
})
```

### Async Component Testing

```typescript
it('loads async data', async () => {
  render(<UserProfile userId="123" />)

  // expect.element() auto-retries until element appears
  await expect.element(screen.getByText('John Doe')).toBeInTheDocument()
})
```

### Mock Service Worker (MSW)

```typescript
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const server = setupServer(
  http.get('/api/users/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'John Doe',
    })
  })
)

describe('User API', () => {
  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('fetches user data', async () => {
    const res = await fetch('/api/users/1')
    const data = await res.json()

    expect(data.name).toBe('John Doe')
  })

  it('handles errors', async () => {
    server.use(
      http.get('/api/users/:id', () => {
        return HttpResponse.json(
          { error: 'Not found' },
          { status: 404 }
        )
      })
    )

    const res = await fetch('/api/users/999')
    expect(res.status).toBe(404)
  })
})
```

### Waiting for Async Operations

```typescript
import { vi } from 'vitest'

it('waits for async operation', async () => {
  let isReady = false

  setTimeout(() => {
    isReady = true
  }, 100)

  await vi.waitFor(() => {
    expect(isReady).toBe(true)
  }, { timeout: 500, interval: 20 })
})
```

### Testing Hooks

```typescript
import { renderHook, waitFor } from 'vitest/browser'
import { useState, useEffect } from 'react'

function useCounter() {
  const [count, setCount] = useState(0)
  return { count, setCount }
}

it('increments counter', async () => {
  const { result } = renderHook(() => useCounter())

  expect(result.current.count).toBe(0)

  result.current.setCount(1)

  await waitFor(() => {
    expect(result.current.count).toBe(1)
  })
})
```

### Snapshot Testing

```typescript
it('matches snapshot', () => {
  const { container } = render(<MyComponent />)
  expect(container.firstChild).toMatchSnapshot()
})
```

---

## Production Anti-Patterns to Avoid

### 1. Not Cleaning Up Camera Resources (html5-qrcode)
```typescript
// ❌ WRONG: Camera not released on unmount
useEffect(() => {
  const scanner = new Html5QrcodeScanner('reader', {})
  scanner.render(() => {}, () => {})
  // Missing cleanup!
})

// ✅ CORRECT
useEffect(() => {
  const scanner = new Html5QrcodeScanner('reader', {})
  scanner.render(() => {}, () => {})

  return () => {
    if (scanner?.getState() !== Html5QrcodeScanner.INACTIVE_STATE) {
      scanner?.pause(true)
      scanner?.clear()
    }
  }
}, [])
```

### 2. Using `SuiClient` on Server
```typescript
// ❌ WRONG: JSON-RPC client on server
import { SuiClient } from '@mysten/sui.js/client'

export async function getBalance(address: string) {
  const client = new SuiClient({ url: rpcUrl })
  return client.getBalance({ owner: address })
}

// ✅ CORRECT: Use SuiGrpcClient
import { SuiGrpcClient } from '@mysten/sui/grpc'

const suiClient = new SuiGrpcClient({ url: rpcUrl })

export async function getBalance(address: string) {
  return suiClient.getBalance({ owner: address })
}
```

### 3. Not Validating Form Input
```typescript
// ❌ WRONG: No validation
export async function createPost(formData: FormData) {
  'use server'
  return db.post.create({
    title: formData.get('title'),
    content: formData.get('content'),
  })
}

// ✅ CORRECT: Validate with Zod
const postSchema = z.object({
  title: z.string().min(5),
  content: z.string().min(10),
})

export async function createPost(formData: FormData) {
  'use server'

  const data = postSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
  })

  if (!data.success) {
    return { error: data.error.flatten() }
  }

  return db.post.create(data.data)
}
```

### 4. Not Using Error Boundaries with Suspense
```typescript
// ❌ WRONG: No error boundary
<Suspense fallback={<div>Loading...</div>}>
  <MyAsyncComponent />
</Suspense>

// ✅ CORRECT
<ErrorBoundary fallback={<div>Error loading</div>}>
  <Suspense fallback={<div>Loading...</div>}>
    <MyAsyncComponent />
  </Suspense>
</ErrorBoundary>
```

### 5. Not Awaiting Promise Params in Next.js 16
```typescript
// ❌ WRONG: Using params directly
export default function Page({ params }: { params: { id: string } }) {
  return <div>{params.id}</div> // May throw
}

// ✅ CORRECT: Await params
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <div>{id}</div>
}
```

### 6. Ignoring Zod Coercion
```typescript
// ❌ WRONG: Implicit type confusion
const userSchema = z.object({
  age: z.number(), // String from form becomes error
})

// ✅ CORRECT: Explicit coercion
const userSchema = z.object({
  age: z.coerce.number(), // "25" → 25
})
```

### 7. Not Setting Proper Cache Directives
```typescript
// ❌ WRONG: Cache not managed
async function getUser(id: string) {
  const res = await fetch(`/api/users/${id}`)
  return res.json()
}

// ✅ CORRECT: Set revalidation
async function getUser(id: string) {
  const res = await fetch(`/api/users/${id}`, {
    next: { revalidate: 60 }, // Revalidate every 60 seconds
  })
  return res.json()
}
```

---

## Debugging & Performance Tips

### Enable React DevTools in Production
```typescript
// next.config.js
module.exports = {
  reactStrictMode: true,
  productionBrowserSourceMaps: true, // For error tracking
}
```

### Monitor Server Component Rendering
```typescript
import { headers } from 'next/headers'

export async function ServerComponent() {
  const headersList = await headers()
  const renderTime = Date.now()

  console.log(`[SSR] ${new Date(renderTime).toISOString()}`)

  return <div>Rendered at {renderTime}</div>
}
```

### Profile TypeScript Compilation
```bash
# Check TypeScript compilation time
tsc --noEmit --diagnostics
```

### Analyze Bundle Size
```bash
# Use next/bundle-analyzer
npm install --save-dev @next/bundle-analyzer
```

---

## Summary Checklist

- [ ] Next.js 16: Using `cacheComponents` instead of `experimental.dynamicIO`
- [ ] React 19: Implemented `useOptimistic` for optimistic updates
- [ ] TypeScript 5: Using `satisfies` and `const` type parameters where appropriate
- [ ] TailwindCSS v4: Migrated to CSS-first config with `@theme`
- [ ] React Query v5: Using `useSuspenseQuery` for streaming SSR
- [ ] TanStack Form v1: Validating with Zod schemas
- [ ] Zod v4: Taking advantage of 6-7x performance improvements
- [ ] html5-qrcode: Properly cleaning up camera resources on unmount
- [ ] qrcode.react: Using QRCodeSVG for responsive codes
- [ ] dApp Kit v2: Using `useCurrentAccount` and `useDAppKit` hooks correctly
- [ ] Vitest v4: Testing with React 19 components and async patterns
- [ ] SUI: Using `SuiGrpcClient` on server, never `SuiClient`

