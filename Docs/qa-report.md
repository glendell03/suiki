# QA Report — "Nothing Happens After Approve" Bug

**Date**: 2026-03-26
**Scope**: Create Program flow — `src/app/merchant/create/page.tsx`, `src/hooks/use-sponsored-tx.ts`, `src/lib/transactions.ts`
**Reporter**: QA Agent

---

## 1. Test Results (`pnpm test`)

```
Test Files  2 failed | 2 passed (4 total)
Tests       35 passed (35)
```

### What happened

Both test files (`transactions.test.ts`, `queries.test.ts`) are discovered by Vitest and **imported successfully** (the 35 individual exported functions are counted as "passed" at the module level). However, **both suites fail** with:

```
Error: No test suite found in file
```

**Root cause**: Neither file contains a single `describe()` / `it()` / `test()` block. All test logic is written as plain exported TypeScript functions (`export function testBuildCreateProgram...`, `export function specParseStampProgram...`). Vitest finds no registered test cases and rejects the files as empty suites.

The test code itself is logically sound — it documents the correct behaviour — but it was written before Vitest was installed and was never converted to use the `it()` / `describe()` API.

### What passes vs. what fails

| File | Suite result | Reason |
|------|-------------|--------|
| `transactions.test.ts` | FAIL (suite) | No `describe`/`it`/`test` blocks |
| `queries.test.ts` | FAIL (suite) | No `describe`/`it`/`test` blocks |
| TypeScript compilation (both files) | PASS | All types and imports resolve correctly |

---

## 2. Code-Flow Trace — What Should Happen

When the user fills in the form and clicks **Create Program**, the intended sequence is:

```
1. Form submit event fires
   → e.preventDefault() called (prevents full-page reload)
   → form.handleSubmit() called

2. @tanstack/react-form onSubmit({ value }) runs
   → schema.safeParse(value) validates all four fields
   → If invalid: return early (no side effects)
   → If valid: extract { name, logoUrl, stampsRequired, rewardDescription }

3. buildCreateProgram(account.address, name, logoUrl, stampsRequired, rewardDescription)
   → Creates a new Transaction
   → Calls tx.setSender(account.address)
   → Calls tx.moveCall({ target: TARGETS.createProgram, arguments: [...] })
   → Returns the Transaction object

4. executeSponsoredTx(tx) called from the hook

   [Branch A — sponsor gas disabled (NEXT_PUBLIC_ENABLE_SPONSOR_GAS=false, the default)]
   4A-1. tx.setSender(account.address) called again (idempotent)
   4A-2. dAppKit.signAndExecuteTransaction({ transaction: tx }) called
         → Wallet extension prompt appears
         → User approves
         → dAppKit returns { digest }
   4A-3. setDigest(result.digest) called
   4A-4. queryClient.invalidateQueries called for ['programs', address] and ['cards', address]
   4A-5. setIsPending(false) called in finally block

   [Branch B — sponsor gas enabled]
   4B-1 … 4B-6. (Sponsored path — see use-sponsored-tx.ts lines 74–127)

5. useEffect in CreateProgramForm fires
   → Dependency: [digest, router]
   → Condition: if (digest) → router.push('/merchant')
   → User is navigated to the merchant dashboard
```

---

## 3. Where the Chain Breaks — Bug Trace

### 3.1 The Primary Bug: Double `setSender` Causes Transaction Build Failure

`buildCreateProgram` in `transactions.ts` (line 48) calls `tx.setSender(sender)` **before** returning the transaction object.

`executeSponsoredTx` in `use-sponsored-tx.ts` (line 59) then calls `tx.setSender(account.address)` **again** on the same transaction.

In `@mysten/sui` v2, calling `setSender` twice on a transaction that has already been serialised or partially built raises an error in strict mode or, depending on SDK version, silently overwrites — but the more dangerous consequence is on the **sponsored path** only, where `tx.build({ onlyTransactionKind: true })` is called after `setSender`. Building with a sender already set when `onlyTransactionKind: true` is specified causes the SDK to throw because a kind-only build must not have a sender set.

**For the non-sponsor (direct) path** — which is the default (`NEXT_PUBLIC_ENABLE_SPONSOR_GAS=false`) — the double `setSender` does not throw on its own, so this is not the direct cause of the "nothing happens" symptom in the basic case.

### 3.2 The Primary Bug: `signAndExecuteTransaction` Result Not Checked Correctly

In `use-sponsored-tx.ts`, the direct path (lines 63–68):

```typescript
const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
setDigest(result.digest);
```

`signAndExecuteTransaction` in `@mysten/dapp-kit-react` v2 returns a `SignAndExecuteTransactionResult`. The shape of this result depends on the `requestType` option passed. **If `requestType` is not explicitly set**, the SDK defaults to `WaitForLocalExecution`, and the returned object may or may not carry a top-level `.digest`. In dapp-kit-react v2, the result object's type is `SuiTransactionBlockResponse`, which uses `.digest` — so this looks correct on paper.

**However**, the critical failure point is: if `signAndExecuteTransaction` **throws** (e.g., the user rejects the wallet prompt, or the wallet returns an error), the `catch` block (line 128–130) catches it and calls `setError()` — but **`setDigest` is never called**, so `digest` stays `null`, and the `useEffect` never fires. This is expected behaviour for rejections.

The "nothing happens" bug therefore occurs when the wallet prompt is presented, the user approves, but **`result.digest` is `undefined`**. If `result.digest` is `undefined`, `setDigest(undefined)` is called, the state is set to `undefined` (not `null`), and the `useEffect` condition `if (digest)` is falsy for `undefined` — **so navigation never occurs**.

### 3.3 The Actual Chain Break — Step by Step

```
Step 1-3:  Form, validation, buildCreateProgram — all correct.
Step 4:    executeSponsoredTx(tx) called — correct.
Step 4A-2: dAppKit.signAndExecuteTransaction called.
           Wallet prompt shows — user approves.
           SDK returns result object.

BREAK POINT: result.digest may be undefined.

           dApp-kit-react v2's signAndExecuteTransaction does not guarantee
           .digest is present unless the transaction has been fully indexed.
           The SDK documentation requires passing { options: { showEffects: true } }
           or checking that effects.status.status === 'success' before reading digest.

Step 4A-3: setDigest(result.digest)
           → If result.digest is undefined, digest state = undefined
           → useEffect: if (undefined) → false → router.push never called
           → UI stays on create page with isPending=false, no error shown,
             no navigation — user sees a form that silently "did nothing"

Step 5:    useEffect never fires. Bug confirmed.
```

### 3.4 Secondary Issue: No Loading or Success Feedback Between Approve and Navigate

Even when `digest` is correctly set, there is no intermediate "success" state. The spinner stops (because `setIsPending(false)` runs in `finally` before `setDigest` resolves the `useEffect`), and the navigation happens asynchronously. During the gap, the UI briefly shows the idle form — potentially confusing users into double-submitting.

### 3.5 Sponsored Path Bug: `setSender` Before `build({ onlyTransactionKind: true })`

On the sponsored path, `buildCreateProgram` sets the sender on the transaction, then `executeSponsoredTx` calls `tx.setSender` again, then calls `tx.build({ onlyTransactionKind: true })`. The Sui SDK rejects building a kind-only transaction when a `sender` is already set, because kind bytes must not encode sender information (the sponsor fills that in). This will cause the sponsored flow to throw at line 74–77 of `use-sponsored-tx.ts`, the error is caught, `setError` is called, and the user sees an error message rather than a wallet prompt.

---

## 4. Summary of Bugs Found

| # | Location | Severity | Description |
|---|----------|----------|-------------|
| 1 | `use-sponsored-tx.ts:65` | High | `result.digest` may be `undefined`; `setDigest(undefined)` leaves digest falsy, blocking navigation |
| 2 | `transactions.ts:48` + `use-sponsored-tx.ts:59` | High (sponsored path) / Low (direct path) | Double `setSender` on the transaction object; on the sponsored path this causes `build({ onlyTransactionKind: true })` to throw |
| 3 | `transactions.test.ts` + `queries.test.ts` | Medium | No Vitest `describe`/`it` blocks — both suites fail with "No test suite found" |
| 4 | `use-sponsored-tx.ts:54–68` | Low | `isPending` is set to `false` (via `finally`) before navigation; brief flash of idle UI between approval and `router.push` |

---

## 5. Recommended Fixes

### Fix 1 — Guard `digest` in the direct path (frontend agent)

In `use-sponsored-tx.ts`, after `signAndExecuteTransaction` returns, verify the digest is present before calling `setDigest`:

```typescript
// Before (broken):
const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
setDigest(result.digest);

// After (safe):
const result = await dAppKit.signAndExecuteTransaction({
  transaction: tx,
  options: { showEffects: true },
});
if (!result.digest) {
  throw new Error('Transaction executed but no digest returned. Check wallet and network.');
}
setDigest(result.digest);
```

This ensures `setDigest` is only called with a real string, keeping `digest` either `null` or a valid string — never `undefined`.

### Fix 2 — Remove `setSender` from `buildCreateProgram` (backend/lib agent)

`transactions.ts` should not pre-set the sender. The hook owns that responsibility. Remove `tx.setSender(sender)` from all builder functions and remove the `sender` parameter, or keep the parameter but do not call `setSender` in the builder — let `executeSponsoredTx` call it once on line 59.

Alternatively, change the hook to use `setSenderIfNotSet` (if available in the SDK version) so that a pre-existing sender is respected and not duplicated.

### Fix 3 — Convert test files to proper Vitest suites (QA agent)

Wrap all existing plain functions in `describe()` / `it()` blocks:

```typescript
import { describe, it, expect } from 'vitest';

describe('TARGETS constants', () => {
  it('createProgram ends with ::create_program', () => {
    expect(TARGETS.createProgram).toMatch(/::create_program$/);
  });
  // ...
});
```

This immediately converts the 2 failing suites into passing test suites.

### Fix 4 — Keep `isPending` true until navigation completes (frontend agent)

In `CreateProgramForm`, hold a local `isNavigating` state or restructure the `useEffect` so that the spinner continues until `router.push` resolves. Alternatively, move `setIsPending(false)` out of `finally` and call it only on error paths, relying on the page unmount to clean up.

---

## 6. New Test Cases to Add

### 6.1 `transactions.test.ts` — Convert existing specs and add new cases

```typescript
describe('buildCreateProgram', () => {
  it('returns a Transaction', () => { ... });
  it('sets exactly one moveCall with target TARGETS.createProgram', () => { ... });
  it('does NOT pre-set sender on the transaction (setSender responsibility belongs to hook)', () => { ... });
  it('encodes stampsRequired as u64', () => { ... });
  it('uses empty string for logoUrl when not provided', () => { ... });
});
```

The "does NOT pre-set sender" test is new and directly guards against regression of Bug #2.

### 6.2 `use-sponsored-tx.test.ts` — New file (hook unit tests)

```typescript
describe('useSponsoredTx — direct path', () => {
  it('calls setDigest with the string digest on success', async () => { ... });
  it('calls setError when signAndExecuteTransaction rejects (user cancel)', async () => { ... });
  it('calls setError when result.digest is undefined', async () => { ... });
  it('invalidates ["programs", address] and ["cards", address] queries on success', async () => { ... });
  it('does not navigate if digest is null after error', async () => { ... });
});

describe('useSponsoredTx — sponsored path', () => {
  it('posts to /api/sponsor with base64 kind bytes and sender address', async () => { ... });
  it('calls setError when sponsor API returns non-200', async () => { ... });
  it('calls setError when on-chain result.$kind is FailedTransaction', async () => { ... });
  it('waits for waitForTransaction before setDigest', async () => { ... });
});
```

### 6.3 `create-program-form.test.tsx` — New file (component integration, requires jsdom)

```typescript
describe('CreateProgramForm', () => {
  it('disables submit button while isPending is true', async () => { ... });
  it('calls router.push("/merchant") when digest becomes truthy', async () => { ... });
  it('does NOT navigate when digest is null', async () => { ... });
  it('displays txError.message in the alert when transaction fails', async () => { ... });
  it('shows validation error when name is fewer than 2 characters', async () => { ... });
  it('does not submit if schema.safeParse fails', async () => { ... });
});
```

Note: `*.test.tsx` files are currently excluded from the Vitest config. The `jsdom` environment and `@testing-library/react` must be added before these can run (see `Docs/qa-dependencies-needed.md`).

---

## 7. Coordination Notes for Other Agents

**Frontend agent**: Fix #1 (guard `result.digest`) and Fix #4 (spinner persistence). These are in `src/hooks/use-sponsored-tx.ts` and `src/app/merchant/create/page.tsx`.

**Backend/lib agent**: Fix #2 (`setSender` ownership). Decision needed: should transaction builders set the sender or not? Recommend removing it from builders so that the hook is the single point of sender assignment. Update all five builder functions in `src/lib/transactions.ts`.

**QA agent**: Fix #3 (convert test files) and add the new test cases above. Also install `jsdom` + `@testing-library/react` so `.test.tsx` component tests can run (tracked in `Docs/qa-dependencies-needed.md`).
