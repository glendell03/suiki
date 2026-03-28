/**
 * scripts/local-cron.mjs
 *
 * Simulates Vercel Cron locally by calling POST /api/indexer/tick
 * every minute. Waits 5 seconds on startup to let Next.js finish booting.
 *
 * Run via: pnpm dev (started automatically alongside the Next.js server)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually (Node --env-file requires Node 20.6+)
const envPath = resolve(process.cwd(), '.env.local');
try {
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local not found — rely on env already being set
}

const SECRET = process.env.CRON_SECRET;
const URL = 'http://localhost:3000/api/indexer/tick';
const INTERVAL_MS = 60_000;
const STARTUP_DELAY_MS = 5_000;

if (!SECRET) {
  console.error('[local-cron] CRON_SECRET is not set — cron will be rejected');
}

async function tick() {
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'x-cron-secret': SECRET ?? '' },
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`[local-cron] ✓ tick ok`, data);
    } else {
      console.warn(`[local-cron] ✗ tick ${res.status}`, data);
    }
  } catch (err) {
    // Server not ready yet or network error — logged but not fatal
    console.warn('[local-cron] tick failed (server ready?)', err.message);
  }
}

console.log(`[local-cron] waiting ${STARTUP_DELAY_MS / 1000}s for Next.js to boot...`);
setTimeout(() => {
  console.log('[local-cron] starting — firing every 60s');
  tick();
  setInterval(tick, INTERVAL_MS);
}, STARTUP_DELAY_MS);
