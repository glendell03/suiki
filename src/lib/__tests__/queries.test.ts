import { describe, it, expect } from 'vitest';
import type { StampProgram, StampCard } from '../../types/sui';
import { asSuiObjectId, asSuiAddress } from '../../types/sui';

/**
 * Compile-time shape checks — these are type assertions, not runtime tests.
 * If the types change, TypeScript will error here before tests even run.
 */
const _programShape: Record<keyof StampProgram, unknown> = {
  objectId: '',
  merchant: '',
  name: '',
  stampsRequired: 0,
  totalIssued: 0,
  version: 0,
  isActive: true,
};
void _programShape;

const _cardShape: Record<keyof StampCard, unknown> = {
  objectId: '',
  programId: '',
  customer: '',
  stampsRequired: 0,
  currentStamps: 0,
  totalEarned: 0,
  lastStamped: 0,
  version: 0,
};
void _cardShape;

describe('StampProgram type', () => {
  it('has required camelCase fields', () => {
    const program: StampProgram = {
      objectId: asSuiObjectId('0xprog'),
      merchant: asSuiAddress('0xmerchant'),
      name: 'Kape ni Juan',
      stampsRequired: 10,
      totalIssued: 42,
      version: 1,
      isActive: true,
    };
    expect(program.name).toBe('Kape ni Juan');
    expect(program.stampsRequired).toBe(10);
    expect(program.totalIssued).toBe(42);
    expect(program.version).toBe(1);
    expect(program.isActive).toBe(true);
  });
});

describe('StampCard type', () => {
  it('has required camelCase fields', () => {
    const card: StampCard = {
      objectId: asSuiObjectId('0xcard'),
      programId: asSuiObjectId('0xprog'),
      customer: asSuiAddress('0xcustomer'),
      stampsRequired: 10,
      currentStamps: 3,
      totalEarned: 1,
      lastStamped: 1700000000000,
      version: 0,
    };
    expect(card.currentStamps).toBe(3);
    expect(card.totalEarned).toBe(1);
    expect(card.version).toBe(0);
  });

  it('snake_case fields do not appear on the type', () => {
    const card = {} as StampCard;
    // @ts-expect-error — snake_case fields must not exist on the parsed type
    void card.current_stamps;
    // @ts-expect-error
    void card.program_id;
  });
});
