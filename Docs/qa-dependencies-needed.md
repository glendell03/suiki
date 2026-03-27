# QA Dependencies Needed for Component Tests

`@testing-library/react` is not currently installed. Component tests in
`src/components/__tests__/` are blocked until the packages below are added.

## Install Command

```bash
pnpm add -D @testing-library/react @testing-library/user-event jsdom @vitejs/plugin-react
```

## Required Changes After Install

### 1. Update `vitest.config.ts`

The current config uses `environment: 'node'`, which has no DOM. Component
tests need `jsdom`. Update `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Default environment for lib/ unit tests
    environment: 'node',
    environmentMatchGlobs: [
      // Use jsdom for all component tests
      ['src/components/**/*.test.tsx', 'jsdom'],
    ],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 2. Uncomment `stamp-progress.test.tsx`

Remove the `/* ... */` block comment in
`src/components/__tests__/stamp-progress.test.tsx` and delete the placeholder
`export {}` at the bottom.

## Tests That Will Be Unlocked

| File | Tests |
|------|-------|
| `src/components/__tests__/stamp-progress.test.tsx` | 10 tests covering dot rendering, text-only mode, edge cases, and accessibility |

## Why These Packages

| Package | Purpose |
|---------|---------|
| `@testing-library/react` | `render`, `screen`, `queryAllByText` etc. |
| `@testing-library/user-event` | Simulated user interactions (click, type) for future tests |
| `jsdom` | Browser DOM emulation in Node.js for vitest |
| `@vitejs/plugin-react` | Vite plugin that transforms JSX/TSX for vitest |
