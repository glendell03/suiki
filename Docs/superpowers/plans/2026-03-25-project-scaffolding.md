# Task 1: Project Scaffolding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Next.js 16 App Router project with TypeScript, Tailwind CSS, PWA config, and all SUI/wallet dependencies so `npm run dev` starts clean at localhost:3000.

**Architecture:** Next.js 16 App Router with TypeScript in `src/`. SUI dApp Kit providers in `src/app/providers.tsx` (client component). PWA via `next-pwa` wrapping next.config.ts. All config in project root.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS, @mysten/sui, @mysten/dapp-kit, @tanstack/react-query, qrcode.react, html5-qrcode, next-pwa

**Source spec:** `Docs/Suiki - Implementation Plan.md` Task 1

---

## File Structure

```
Suiki-task-1-project-scaffolding/
├── src/
│   └── app/
│       ├── layout.tsx          # Root layout importing providers
│       ├── page.tsx            # Landing page placeholder
│       ├── providers.tsx       # SUI + Wallet + React Query providers (client)
│       └── globals.css         # Tailwind imports
├── public/
│   ├── manifest.json           # PWA manifest
│   └── icons/
│       ├── icon-192.png        # PWA icon 192x192
│       └── icon-512.png        # PWA icon 512x512
├── next.config.ts              # Next.js config wrapped with withPWA
├── tsconfig.json               # TypeScript config
├── tailwind.config.ts          # Tailwind config
├── package.json                # All dependencies
└── .env.local.example          # Environment variable template
```

---

### Task 1: Scaffold Next.js 16 Project

**Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Create Next.js project in current directory**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --yes
```

Expected: Scaffolds `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `src/app/` — does NOT overwrite existing `.github/` or `Docs/`.

- [ ] **Step 2: Verify dev server starts**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
npm run dev &
sleep 8
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
kill %1 2>/dev/null
```

Expected: HTTP 200

- [ ] **Step 3: Commit scaffolding**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
git add -A
git commit -m "chore: scaffold Next.js 16 with TypeScript, Tailwind, App Router"
```

---

### Task 2: Install SUI and QR Dependencies

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install SUI ecosystem packages**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
npm install @mysten/sui @mysten/dapp-kit @tanstack/react-query
```

Expected: Added to `dependencies`.

- [ ] **Step 2: Install QR code packages**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
npm install qrcode.react html5-qrcode
npm install -D @types/qrcode.react
```

Expected: `qrcode.react` and `html5-qrcode` in `dependencies`, `@types/qrcode.react` in `devDependencies`.

- [ ] **Step 3: Verify TypeScript resolves**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit dependencies**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
git add package.json package-lock.json
git commit -m "chore: install SUI, dapp-kit, react-query, QR deps"
```

---

### Task 3: Create SUI Providers Component

**Files:** `src/app/providers.tsx`

- [ ] **Step 1: Create providers.tsx**

Create `src/app/providers.tsx`:

```tsx
"use client";

import { createNetworkConfig, SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@mysten/dapp-kit/dist/index.css";

const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl("testnet") },
  mainnet: { url: getFullnodeUrl("mainnet") },
  devnet: { url: getFullnodeUrl("devnet") },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit providers**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
git add src/app/providers.tsx
git commit -m "feat: add SUI client + wallet providers"
```

---

### Task 4: Install and Configure PWA

**Files:** `next.config.ts`, `public/manifest.json`, `public/icons/`, `.gitignore`

- [ ] **Step 1: Install next-pwa**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
npm install next-pwa
```

- [ ] **Step 2: Update next.config.ts with PWA plugin**

Replace `next.config.ts` contents with:

```ts
import withPWA from "next-pwa";

const nextConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})({
  reactStrictMode: true,
});

export default nextConfig;
```

- [ ] **Step 3: Create public/manifest.json**

```json
{
  "name": "Suiki — Loyalty on SUI",
  "short_name": "Suiki",
  "description": "Merchant loyalty stamp cards powered by SUI blockchain",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#3b82f6",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 4: Create placeholder PWA icons directory**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
mkdir -p public/icons
# Minimal valid 1x1 PNG placeholder
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82' > public/icons/icon-192.png
cp public/icons/icon-192.png public/icons/icon-512.png
```

- [ ] **Step 5: Update .gitignore for PWA build artifacts**

Append to `.gitignore`:

```
# PWA
public/sw.js
public/workbox-*.js
public/sw.js.map
public/workbox-*.js.map
```

- [ ] **Step 6: Commit PWA config**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
git add next.config.ts public/manifest.json public/icons/ .gitignore
git commit -m "feat: configure PWA with manifest and service worker"
```

---

### Task 5: Wire Root Layout with Providers

**Files:** `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Update root layout to include Providers**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Suiki — Loyalty on SUI",
  description: "Merchant loyalty stamp cards powered by SUI blockchain",
  manifest: "/manifest.json",
  themeColor: "#3b82f6",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Suiki",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Update landing page**

Replace `src/app/page.tsx` with:

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-900 text-white">
      <h1 className="text-4xl font-bold">Suiki</h1>
      <p className="mt-4 text-lg text-slate-400">
        Loyalty stamp cards on SUI blockchain
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit layout and page**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
git add src/app/layout.tsx src/app/page.tsx
git commit -m "feat: wire root layout with SUI providers and PWA metadata"
```

---

### Task 6: Create Environment Variable Template

**Files:** `.env.local.example`

- [ ] **Step 1: Create .env.local.example**

```
# SUI Network
NEXT_PUBLIC_SUI_NETWORK=testnet

# Deployed Move package ID (fill after Task 4: Deploy)
NEXT_PUBLIC_PACKAGE_ID=0x_PLACEHOLDER_AFTER_DEPLOY

# Gas station sponsor private key (base64-encoded Ed25519)
SPONSOR_PRIVATE_KEY=_BASE64_ENCODED_ED25519_KEY
```

- [ ] **Step 2: Commit env template**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
git add .env.local.example
git commit -m "chore: add .env.local.example template"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run full type check**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 2: Verify manifest is valid JSON**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
node -e "JSON.parse(require('fs').readFileSync('public/manifest.json','utf8')); console.log('manifest.json OK')"
```

Expected: `manifest.json OK`

- [ ] **Step 3: Verify all deps are importable**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
node -e "
require('@mysten/sui/client');
require('@tanstack/react-query');
require('qrcode.react');
require('html5-qrcode');
console.log('All deps importable');
"
```

Expected: `All deps importable`

- [ ] **Step 4: Start dev server and confirm HTTP 200**

```bash
cd /Users/glendell/projects/suiki/Suiki-task-1-project-scaffolding
npm run dev &
sleep 8
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
kill %1 2>/dev/null
```

Expected: `200`
