import { describe, it, expect } from 'vitest';
import type { StampProgram, StampCard } from '../../types/sui';

/**
 * Compile-time shape checks — these are type assertions, not runtime tests.
 * If the types change, TypeScript will error here before tests even run.
 */
const _programShape: Record<keyof StampProgram, unknown> = {
  objectId: '',
  merchant: '',
  name: '',
  logoUrl: '',
  stampsRequired: 0,
  rewardDescription: '',
  totalIssued: 0,
};
void _programShape;

const _cardShape: Record<keyof StampCard, unknown> = {
  objectId: '',
  programId: '',
  customer: '',
  merchantName: '',
  merchantLogo: '',
  stampsRequired: 0,
  currentStamps: 0,
  totalEarned: 0,
  lastStamped: 0,
};
void _cardShape;

describe('StampProgram type', () => {
  it('has required camelCase fields', () => {
    const program: StampProgram = {
      objectId: '0xprog',
      merchant: '0xmerchant',
      name: 'Kape ni Juan',
      logoUrl: 'https://example.com/logo.png',
      stampsRequired: 10,
      rewardDescription: 'Free brewed coffee',
      totalIssued: 42,
    };
    expect(program.name).toBe('Kape ni Juan');
    expect(program.stampsRequired).toBe(10);
    expect(program.totalIssued).toBe(42);
  });
});

describe('StampCard type', () => {
  it('has required camelCase fields', () => {
    const card: StampCard = {
      objectId: '0xcard',
      programId: '0xprog',
      customer: '0xcustomer',
      merchantName: 'Kape ni Juan',
      merchantLogo: 'https://example.com/logo.png',
      stampsRequired: 10,
      currentStamps: 3,
      totalEarned: 1,
      lastStamped: 1700000000000,
    };
    expect(card.merchantName).toBe('Kape ni Juan');
    expect(card.currentStamps).toBe(3);
    expect(card.totalEarned).toBe(1);
  });

  it('snake_case fields do not appear on the type', () => {
    const card = {} as StampCard;
    // @ts-expect-error — snake_case fields must not exist on the parsed type
    void card.merchant_name;
    // @ts-expect-error
    void card.current_stamps;
    // @ts-expect-error
    void card.program_id;
  });
});
