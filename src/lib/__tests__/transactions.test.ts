/**
 * Tests for src/lib/transactions.ts
 *
 * Setup required before running (vitest is not yet installed):
 *   npm install -D vitest @vitest/coverage-v8
 *   Add to package.json scripts: "test": "vitest run"
 *
 * This file is structured to compile cleanly without vitest installed.
 * All test logic is expressed as plain TypeScript that can be executed
 * once the test runner is in place.
 */

import { TARGETS, CLOCK_ID } from '../constants';
import {
  buildCreateProgram,
  buildCreateCardAndStamp,
  buildIssueStamp,
  buildRedeem,
  buildUpdateProgram,
} from '../transactions';

// ---------------------------------------------------------------------------
// Type-level assertions — always compiled, never require a test runner
// ---------------------------------------------------------------------------

// Verify TARGETS shape is correct at compile time.
const _targetsCheck: {
  createProgram: string;
  createCardAndStamp: string;
  issueStamp: string;
  redeem: string;
  updateProgram: string;
} = TARGETS;
void _targetsCheck;

// Verify CLOCK_ID literal type.
const _clockCheck: '0x6' = CLOCK_ID;
void _clockCheck;

// ---------------------------------------------------------------------------
// Runtime assertions — plain functions, no test framework required.
// Copy these into vitest `it()` blocks once vitest is installed.
// ---------------------------------------------------------------------------

/** Minimal assertion helper that throws on failure. */
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertMatches(value: string, pattern: RegExp, message: string): void {
  assert(pattern.test(value), `${message} — got: "${value}"`);
}

// ---------------------------------------------------------------------------
// TARGETS constant sanity checks
// Run: node -e "require('./src/lib/__tests__/transactions.test.ts')" after ts-node setup
// ---------------------------------------------------------------------------

export function testTargetsConstants(): void {
  assertMatches(TARGETS.createProgram, /::create_program$/, 'createProgram ends with ::create_program');
  assertMatches(TARGETS.createCardAndStamp, /::create_card_and_stamp$/, 'createCardAndStamp ends with ::create_card_and_stamp');
  assertMatches(TARGETS.issueStamp, /::issue_stamp$/, 'issueStamp ends with ::issue_stamp');
  assertMatches(TARGETS.redeem, /::redeem$/, 'redeem ends with ::redeem');
  assertMatches(TARGETS.updateProgram, /::update_program$/, 'updateProgram ends with ::update_program');
  assert(CLOCK_ID === '0x6', 'CLOCK_ID is 0x6');
}

// ---------------------------------------------------------------------------
// Builder stub-behaviour tests
//
// Before @mysten/sui is installed, every builder calls newTransaction() which
// throws a descriptive Error. Each function below verifies that contract.
// ---------------------------------------------------------------------------

const STUB_ERROR_PATTERN = /npm install @mysten\/sui/i;

function assertBuilderThrows(fn: () => unknown, name: string): void {
  try {
    fn();
    throw new Error(`${name} should have thrown but did not`);
  } catch (err) {
    if (err instanceof Error && STUB_ERROR_PATTERN.test(err.message)) return;
    // Re-throw unexpected errors (including the sentinel above).
    throw err;
  }
}

export function testBuildCreateProgramThrows(): void {
  assertBuilderThrows(
    () => buildCreateProgram('0xsender', 'Kape ni Juan', 'https://example.com/logo.png', 10, 'Free brewed coffee'),
    'buildCreateProgram',
  );
}

export function testBuildCreateCardAndStampThrows(): void {
  assertBuilderThrows(
    () => buildCreateCardAndStamp('0xsender', '0xprogram', '0xcustomer'),
    'buildCreateCardAndStamp',
  );
}

export function testBuildIssueStampThrows(): void {
  assertBuilderThrows(
    () => buildIssueStamp('0xsender', '0xprogram', '0xcard'),
    'buildIssueStamp',
  );
}

export function testBuildRedeemThrows(): void {
  assertBuilderThrows(
    () => buildRedeem('0xsender', '0xprogram', '0xcard'),
    'buildRedeem',
  );
}

export function testBuildUpdateProgramThrows(): void {
  assertBuilderThrows(
    () => buildUpdateProgram('0xsender', '0xprogram', 'New Name', 'https://example.com/new-logo.png', 'New reward'),
    'buildUpdateProgram',
  );
}

// ---------------------------------------------------------------------------
// Post-install behavioural spec (TODO: convert to vitest once installed)
//
// After `npm install @mysten/sui` and the stub is replaced with the real
// Transaction class, the tests below describe the expected behaviour.
// Each is expressed as a plain comment-driven spec — paste into vitest
// it() blocks and replace the TODO comments with live assertions.
// ---------------------------------------------------------------------------

/*
POST-INSTALL: buildCreateProgram
  - returns a Transaction with exactly one moveCall
  - moveCall target === TARGETS.createProgram
  - arguments[0] === tx.pure.string(name)
  - arguments[1] === tx.pure.string(logoUrl)
  - arguments[2] === tx.pure.u64(stampsRequired)
  - arguments[3] === tx.pure.string(rewardDescription)
  - setSender / setSenderIfNotSet can be called on the returned Transaction

POST-INSTALL: buildCreateCardAndStamp
  - moveCall target === TARGETS.createCardAndStamp
  - arguments[0] === tx.object(programId)
  - arguments[1] === tx.pure.address(customerAddress)
  - arguments[2] === tx.object(CLOCK_ID)  ← clock is always the third arg

POST-INSTALL: buildIssueStamp
  - moveCall target === TARGETS.issueStamp
  - arguments[0] === tx.object(programId)  ← &mut StampProgram
  - arguments[1] === tx.object(cardId)     ← &mut StampCard
  - arguments[2] === tx.object(CLOCK_ID)

POST-INSTALL: buildRedeem
  - moveCall target === TARGETS.redeem
  - arguments[0] === tx.object(programId)  ← &StampProgram (immutable ref)
  - arguments[1] === tx.object(cardId)     ← &mut StampCard
  - NO clock argument (redeem Move sig has no clock param)
  - arguments.length === 2

POST-INSTALL: buildUpdateProgram
  - moveCall target === TARGETS.updateProgram
  - arguments[0] === tx.object(programId)
  - arguments[1] === tx.pure.string(name)
  - arguments[2] === tx.pure.string(logoUrl)
  - arguments[3] === tx.pure.string(rewardDescription)
  - arguments.length === 4

POST-INSTALL: all builders
  - setSenderIfNotSet(address) callable on returned Transaction
  - build({ onlyTransactionKind: true }) resolves to Uint8Array
*/
