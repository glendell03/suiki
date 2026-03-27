import { describe, it, expect } from 'vitest';
import { Transaction } from '@mysten/sui/transactions';
import { TARGETS, CLOCK_ID } from '../constants';
import {
  buildCreateProgram,
  buildCreateCardAndStamp,
  buildIssueStamp,
  buildIssueStampAsStaffer,
  buildRedeem,
  buildUpdateProgram,
  buildSetTheme,
  buildDeactivateProgram,
  buildReactivateProgram,
  buildIssueStafferCap,
  buildCreateMerchantProfile,
  buildCreateProfileAndPurchaseTheme,
  buildPurchaseTheme,
  buildSetPremiumTheme,
} from '../transactions';

const SENDER = '0x1111111111111111111111111111111111111111111111111111111111111111';
const PROGRAM = '0x2222222222222222222222222222222222222222222222222222222222222222';
const CUSTOMER = '0x3333333333333333333333333333333333333333333333333333333333333333';
const CARD = '0x4444444444444444444444444444444444444444444444444444444444444444';
const STAFFER_CAP = '0x5555555555555555555555555555555555555555555555555555555555555555';
const PROFILE = '0x6666666666666666666666666666666666666666666666666666666666666666';
const STAFFER = '0x7777777777777777777777777777777777777777777777777777777777777777';

describe('TARGETS constants', () => {
  it('each target ends with the correct function name', () => {
    expect(TARGETS.createProgram).toMatch(/::create_program$/);
    expect(TARGETS.createCardAndStamp).toMatch(/::create_card_and_stamp$/);
    expect(TARGETS.issueStamp).toMatch(/::issue_stamp$/);
    expect(TARGETS.issueStampAsStaffer).toMatch(/::issue_stamp_as_staffer$/);
    expect(TARGETS.redeem).toMatch(/::redeem$/);
    expect(TARGETS.updateProgram).toMatch(/::update_program$/);
    expect(TARGETS.deactivateProgram).toMatch(/::deactivate_program$/);
    expect(TARGETS.reactivateProgram).toMatch(/::reactivate_program$/);
    expect(TARGETS.createStafferCap).toMatch(/::create_staffer_cap$/);
  });

  it('CLOCK_ID is the Sui system clock address 0x6', () => {
    expect(CLOCK_ID).toBe('0x6');
  });
});

describe('buildCreateProgram', () => {
  it('returns a Transaction instance', () => {
    const tx = buildCreateProgram({ name: 'Kape', stampsRequired: 10 });
    expect(tx).toBeInstanceOf(Transaction);
  });

  it('accepts optional themeId', () => {
    const tx = buildCreateProgram({ name: 'Kape', stampsRequired: 10, themeId: 2 });
    expect(tx).toBeInstanceOf(Transaction);
  });

  it('setSenderIfNotSet is callable on the result', () => {
    const tx = buildCreateProgram({ name: 'Kape', stampsRequired: 10 });
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

describe('buildIssueStampAsStaffer', () => {
  it('returns a Transaction instance', () => {
    const tx = buildIssueStampAsStaffer(SENDER, PROGRAM, CARD, STAFFER_CAP);
    expect(tx).toBeInstanceOf(Transaction);
  });

  it('accepts 4 arguments (sender, programId, cardId, stafferCapId)', () => {
    expect(buildIssueStampAsStaffer.length).toBe(4);
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
    const tx = buildUpdateProgram(SENDER, PROGRAM, 'New Name');
    expect(tx).toBeInstanceOf(Transaction);
  });

  it('V3: accepts only (sender, programId, name) — no logoUrl or rewardDescription', () => {
    expect(buildUpdateProgram.length).toBe(3);
  });
});

describe('buildSetTheme', () => {
  it('returns a Transaction instance', () => {
    const tx = buildSetTheme(SENDER, PROGRAM, 2);
    expect(tx).toBeInstanceOf(Transaction);
  });
});

describe('buildDeactivateProgram', () => {
  it('returns a Transaction instance', () => {
    const tx = buildDeactivateProgram(SENDER, PROGRAM);
    expect(tx).toBeInstanceOf(Transaction);
  });

  it('accepts exactly 2 arguments (sender, programId)', () => {
    expect(buildDeactivateProgram.length).toBe(2);
  });
});

describe('buildReactivateProgram', () => {
  it('returns a Transaction instance', () => {
    const tx = buildReactivateProgram(SENDER, PROGRAM);
    expect(tx).toBeInstanceOf(Transaction);
  });

  it('accepts exactly 2 arguments (sender, programId)', () => {
    expect(buildReactivateProgram.length).toBe(2);
  });
});

describe('buildIssueStafferCap', () => {
  it('returns a Transaction instance', () => {
    const tx = buildIssueStafferCap(SENDER, PROGRAM, STAFFER);
    expect(tx).toBeInstanceOf(Transaction);
  });

  it('accepts 3 arguments (sender, programId, stafferAddress)', () => {
    expect(buildIssueStafferCap.length).toBe(3);
  });
});

describe('buildCreateMerchantProfile', () => {
  it('returns a Transaction instance', () => {
    const tx = buildCreateMerchantProfile(SENDER);
    expect(tx).toBeInstanceOf(Transaction);
  });
});

describe('buildCreateProfileAndPurchaseTheme', () => {
  it('returns a Transaction instance', () => {
    const tx = buildCreateProfileAndPurchaseTheme(SENDER, 5);
    expect(tx).toBeInstanceOf(Transaction);
  });
});

describe('buildPurchaseTheme', () => {
  it('returns a Transaction instance', () => {
    const tx = buildPurchaseTheme(SENDER, PROFILE, 3);
    expect(tx).toBeInstanceOf(Transaction);
  });
});

describe('buildSetPremiumTheme', () => {
  it('returns a Transaction instance', () => {
    const tx = buildSetPremiumTheme(SENDER, PROGRAM, PROFILE, 3);
    expect(tx).toBeInstanceOf(Transaction);
  });
});
