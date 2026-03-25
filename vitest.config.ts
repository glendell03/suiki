/**
 * Vitest configuration for Suiki.
 *
 * - environment: 'node' for all lib unit tests (pure TypeScript, no DOM)
 * - paths: mirrors the @/* alias from tsconfig.json
 *
 * Component tests that need a DOM (stamp-progress.test.tsx) require
 * @testing-library/react and jsdom — see docs/qa-dependencies-needed.md.
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    // Component tests (*.test.tsx) are excluded until @testing-library/react
    // and jsdom are installed. See docs/qa-dependencies-needed.md.
    include: ['src/**/*.test.ts'],
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
