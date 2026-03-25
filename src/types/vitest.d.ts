/**
 * Minimal ambient type declarations for vitest.
 *
 * vitest is not yet installed (run `npm install -D vitest` to add it).
 * This file prevents TypeScript compilation errors in test files that import
 * from 'vitest' while keeping strict mode enabled everywhere else.
 *
 * Remove this file once vitest is installed — the real package types take over.
 */

declare module 'vitest' {
  // Core test organisation
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn?: () => void | Promise<void>): void;
  export namespace it {
    function todo(name: string, fn?: () => void): void;
  }
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function expect(value: unknown): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toMatch(pattern: string | RegExp): void;
    toThrow(pattern?: string | RegExp): void;
    toHaveLength(length: number): void;
    toBeUndefined(): void;
    resolves: {
      toBe(expected: unknown): Promise<void>;
    };
  };

  // Mock utilities
  export type Mock = {
    (...args: unknown[]): unknown;
    mockReturnValue(value: unknown): Mock;
    mockResolvedValue(value: unknown): Mock;
  };
  export const vi: {
    fn(): Mock;
    mock(
      modulePath: string,
      factory?: (importOriginal: <T>() => Promise<T>) => unknown,
    ): void;
    spyOn(object: object, method: string): Mock;
    useFakeTimers(): void;
    useRealTimers(): void;
    setSystemTime(date: Date | number | string): void;
    stubGlobal(name: string, value: unknown): void;
    unstubAllGlobals(): void;
    clearAllMocks(): void;
    resetAllMocks(): void;
    restoreAllMocks(): void;
  };
}
