/**
 * Gas-sponsor API route — POST /api/sponsor
 *
 * Security fixes implemented:
 *   FIND-01 (Critical): Deserializes PTB bytes and validates EVERY command targets
 *                       an allowed suiki::suiki function before signing.
 *   FIND-16 (High):     Rejects the entire PTB if ANY command is not in the allowlist,
 *                       not just the first one.
 *   FIND-02 (High):     Rate limits per sender address AND per IP (in-memory stub;
 *                       replace with Redis before mainnet — see TODO below).
 *
 * The server NEVER signs a transaction that contains calls to unauthorized modules
 * or non-MoveCall commands (TransferObjects, SplitCoins, etc.).
 *
 * Request:  POST { txKindBytes: string (base64), sender: string }
 * Response: { transactionBytes: string, sponsorSignature: string }
 *           or { error: string } with an appropriate HTTP status code.
 *
 * Environment variables required:
 *   SPONSOR_PRIVATE_KEY         — Ed25519 secret key, base64-encoded (server-only, never NEXT_PUBLIC_)
 *   NEXT_PUBLIC_PACKAGE_ID      — Deployed package ID (0x-prefixed)
 *   NEXT_PUBLIC_SUI_NETWORK     — "testnet" | "mainnet" (default: "testnet")
 */

import { NextRequest, NextResponse } from 'next/server';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

import { suiClient } from '@/lib/sui-client';
import { PACKAGE_ID, MODULE_NAME } from '@/lib/constants';
import { env } from '@/env';
import type { SponsoredTxRequest, SponsoredTxResponse } from '@/types/sui';

// ---------------------------------------------------------------------------
// Move function allowlist
// ---------------------------------------------------------------------------

/**
 * Exhaustive set of function names in the suiki::suiki module that the sponsor
 * is authorised to pay gas for.
 *
 * Source of truth: move/suiki/sources/suiki.move — public fun declarations.
 * Any function NOT in this set will cause the entire PTB to be rejected.
 */
const ALLOWED_FUNCTIONS = new Set<string>([
  'create_program',
  'create_card_and_stamp',
  'issue_stamp',
  'redeem',
  'update_program',
  'sync_card_metadata',
  'transfer_merchant',
]);

/** Fully-qualified module path that every MoveCall target must start with. */
const ALLOWED_MODULE = `${PACKAGE_ID}::${MODULE_NAME}` as const;

// ---------------------------------------------------------------------------
// In-memory rate limiter
// ---------------------------------------------------------------------------

/**
 * TODO (FIND-02 / pre-mainnet): Replace this in-memory Map with a Redis-backed
 * rate limiter (e.g. `@upstash/ratelimit` or `ioredis` + sliding window).
 * The in-memory store is per-process and will not share state across multiple
 * Next.js server instances or across restarts.
 */
interface RateLimitEntry {
  count: number;
  /** Unix ms when the current window expires and the counter resets. */
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/** Maximum sponsored transactions allowed per key per 24-hour window. */
const RATE_LIMIT_MAX = 50;

/** Duration of a rate-limit window in milliseconds (24 hours). */
const WINDOW_MS = 86_400_000;

/**
 * Checks and increments the rate-limit counter for a given key.
 *
 * @param key - Arbitrary string key (e.g. sender address or `ip:<addr>`).
 * @returns `true` if the request is within the limit; `false` if it should be rejected.
 */
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

// ---------------------------------------------------------------------------
// PTB validation
// ---------------------------------------------------------------------------

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates every command in a deserialized Transaction.
 *
 * Rules enforced (FIND-01 + FIND-16):
 *  1. The PTB must contain at least one command.
 *  2. EVERY command must be a MoveCall — no TransferObjects, SplitCoins, etc.
 *  3. EVERY MoveCall must target `{PACKAGE_ID}::suiki` (the authorized module).
 *  4. EVERY function name must be in ALLOWED_FUNCTIONS.
 *
 * @param tx - Deserialized Transaction instance.
 * @returns ValidationResult with `valid: true` or `valid: false` and a `reason`.
 */
function validateAllCommands(tx: Transaction): ValidationResult {
  const data = tx.getData();

  if (!data.commands || data.commands.length === 0) {
    return { valid: false, reason: 'Transaction has no commands' };
  }

  // Iterate every command — FIND-16: reject if ANY command fails, not just the first.
  for (const command of data.commands) {
    if (command.$kind !== 'MoveCall') {
      return {
        valid: false,
        reason: `Non-MoveCall command rejected: ${command.$kind}`,
      };
    }

    const { package: pkg, module: mod, function: fn } = command.MoveCall;
    const callTarget = `${pkg}::${mod}`;

    if (callTarget !== ALLOWED_MODULE) {
      return {
        valid: false,
        reason: `Call to unauthorized module rejected: ${callTarget}`,
      };
    }

    if (!ALLOWED_FUNCTIONS.has(fn)) {
      return {
        valid: false,
        reason: `Call to unauthorized function rejected: ${fn}`,
      };
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

/**
 * POST /api/sponsor
 *
 * Accepts a partially-built transaction (transaction-kind bytes), validates all
 * Move calls against the suiki allowlist, then signs as the gas sponsor and
 * returns the signed bytes + sponsor signature for the client to counter-sign.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // --- Parse request body ---------------------------------------------------
  let body: Partial<SponsoredTxRequest>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { txKindBytes, sender } = body;

  if (!txKindBytes || typeof txKindBytes !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid txKindBytes' }, { status: 400 });
  }
  if (!sender || typeof sender !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid sender address' }, { status: 400 });
  }

  // --- Environment guard ----------------------------------------------------
  // Refuse to operate if the package has not been deployed yet.
  if (!PACKAGE_ID || PACKAGE_ID === '0x_PLACEHOLDER') {
    return NextResponse.json(
      { error: 'Contract not deployed. NEXT_PUBLIC_PACKAGE_ID is not set.' },
      { status: 503 },
    );
  }

  // --- Rate limiting (FIND-02) ----------------------------------------------
  // Apply limits per sender address AND per originating IP address.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  // Check sender first — if blocked return immediately (no side effect on IP counter)
  if (!checkRateLimit(sender)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 50 sponsored transactions per day.' },
      { status: 429 },
    );
  }
  // Check IP — if blocked, roll back the sender increment to avoid draining quota
  if (!checkRateLimit(`ip:${ip}`)) {
    const entry = rateLimitStore.get(sender);
    if (entry && entry.count > 0) entry.count -= 1;
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 50 sponsored transactions per day.' },
      { status: 429 },
    );
  }

  // --- Deserialize transaction (FIND-01) ------------------------------------
  let tx: Transaction;
  try {
    tx = Transaction.from(Buffer.from(txKindBytes, 'base64'));
  } catch {
    return NextResponse.json({ error: 'Invalid transaction bytes' }, { status: 400 });
  }

  // --- Validate ALL commands (FIND-01 + FIND-16) ----------------------------
  const validation = validateAllCommands(tx);
  if (!validation.valid) {
    return NextResponse.json(
      { error: `Transaction rejected: ${validation.reason}` },
      { status: 403 },
    );
  }

  // --- Load sponsor keypair -------------------------------------------------
  let sponsorKeypair: Ed25519Keypair;
  try {
    sponsorKeypair = Ed25519Keypair.fromSecretKey(Buffer.from(env.SPONSOR_PRIVATE_KEY, 'base64'));
  } catch {
    return NextResponse.json({ error: 'Invalid sponsor keypair configuration' }, { status: 503 });
  }

  const sponsorAddress = sponsorKeypair.toSuiAddress();

  // --- Set gas owner and sign as sponsor ------------------------------------
  // In a sponsored transaction:
  //   1. setSender → the user who is executing the tx
  //   2. setGasOwner → the sponsor who pays gas
  // The sponsor signs; the client-side user also signs (with their own signature)
  // and both signatures are submitted together via core.executeTransaction().
  try {
    tx.setSenderIfNotSet(sender);
    tx.setGasOwner(sponsorAddress);

    // Fetch sponsor's SUI coins to use as gas payment.
    // listCoins defaults to 0x2::sui::SUI and returns Coin objects with their
    // objectId, version, and digest — exactly what setGasPayment requires.
    const gasCoins = await suiClient.listCoins({
      owner: sponsorAddress,
      limit: 1,
    });

    const gasPayment = gasCoins.objects.map((coin) => ({
      objectId: coin.objectId,
      version: coin.version,
      digest: coin.digest,
    }));

    if (gasPayment.length === 0) {
      return NextResponse.json({ error: 'Sponsor has no SUI coins for gas' }, { status: 503 });
    }

    tx.setGasPayment(gasPayment);
    tx.setGasBudget(10_000_000); // 0.01 SUI — sufficient for suiki Move calls

    // Pass suiClient so the Transaction can resolve object versions during build.
    const { bytes, signature: sponsorSignature } = await tx.sign({
      client: suiClient,
      signer: sponsorKeypair,
    });

    const response: SponsoredTxResponse = {
      transactionBytes: bytes,
      sponsorSignature,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[sponsor] Failed to sign transaction:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
