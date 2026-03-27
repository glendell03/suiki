import { describe, it, expect } from 'vitest';
import { Transaction } from '@mysten/sui/transactions';
import { TARGETS, CLOCK_ID } from '../constants';
import {
  buildCreateProgram,
  buildCreateCardAndStamp,
  buildIssueStamp,
  buildRedeem,
  buildUpdateProgram,
} from '../transactions';

const SENDER = '0x1111111111111111111111111111111111111111111111111111111111111111';
const PROGRAM = '0x2222222222222222222222222222222222222222222222222222222222222222';
const CUSTOMER = '0x3333333333333333333333333333333333333333333333333333333333333333';
const CARD = '0x4444444444444444444444444444444444444444444444444444444444444444';

describe('TARGETS constants', () => {
  it('each target ends with the correct function name', () => {
    expect(TARGETS.createProgram).toMatch(/::create_program$/);
    expect(TARGETS.createCardAndStamp).toMatch(/::create_card_and_stamp$/);
    expect(TARGETS.issueStamp).toMatch(/::issue_stamp$/);
    expect(TARGETS.redeem).toMatch(/::redeem$/);
    expect(TARGETS.updateProgram).toMatch(/::update_program$/);
  });

  it('CLOCK_ID is the Sui system clock address 0x6', () => {
    expect(CLOCK_ID).toBe('0x6');
  });
});

describe('buildCreateProgram', () => {
  it('returns a Transaction instance', () => {
    const tx = buildCreateProgram(SENDER, 'Kape', 'https://example.com/logo.png', 10, 'Free coffee');
    expect(tx).toBeInstanceOf(Transaction);
  });

  it('setSenderIfNotSet is callable on the result', () => {
    const tx = buildCreateProgram(SENDER, 'Kape', 'https://example.com/logo.png', 10, 'Free coffee');
    expect(() => tx.setSenderIfNotSet(SENDER)).not.toThrow();
  });
});

describe('buildCreateCardAndStamp', () => {
  it('returns a Transaction instance', () => {
    const tx = buildCreateCardAndStamp(SENDER, PROGRAM, CUSTOMER);
    expect(tx).toBeInstanceOf(Transaction);
  });
});

describe('buildIssueStamp', () => {
  it('returns a Transaction instance', () => {
    const tx = buildIssueStamp(SENDER, PROGRAM, CARD);
    expect(tx).toBeInstanceOf(Transaction);
  });
});

describe('buildRedeem', () => {
  it('returns a Transaction instance', () => {
    const tx = buildRedeem(SENDER, PROGRAM, CARD);
    expect(tx).toBeInstanceOf(Transaction);
  });
});

describe('buildUpdateProgram', () => {
  it('returns a Transaction instance', () => {
    const tx = buildUpdateProgram(SENDER, PROGRAM, 'New Name', 'https://example.com/new.png', 'New reward');
    expect(tx).toBeInstanceOf(Transaction);
  });
});
