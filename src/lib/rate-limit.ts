/**
 * Client-side daily transaction rate-limit utilities for Suiki.
 *
 * Suiki MSMEs operate on modest SUI gas budgets. Soft rate-limiting at 50
 * stamp transactions per merchant per calendar day prevents accidental
 * gas exhaustion and discourages abuse.
 *
 * Storage: localStorage, keyed by date + merchant address so the counter
 * resets automatically at midnight without any explicit cleanup.
 *
 * Key format: `suiki_daily_tx_YYYY-MM-DD_<merchantAddress>`
 *
 * Thresholds:
 *   NEAR  >= 40  (warn the merchant — getting close)
 *   LIMIT >= 50  (block further stamps for the day)
 */

/** Transactions per day before the limit is reached. */
export const DAILY_LIMIT = 50;

/** Transactions per day at which a "near limit" warning is shown. */
export const NEAR_LIMIT_THRESHOLD = 40;

/**
 * Build the localStorage key for today's counter for a given merchant.
 *
 * The date segment uses the local calendar date so the counter rolls over at
 * local midnight rather than UTC midnight — better UX for Filipino MSMEs.
 */
function buildKey(merchantAddress: string): string {
  const date = new Date();
  // YYYY-MM-DD using local date parts
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `suiki_daily_tx_${yyyy}-${mm}-${dd}_${merchantAddress}`;
}

/**
 * Return the number of stamp transactions issued today for a merchant.
 *
 * Returns 0 when no key exists (first transaction of the day) or when
 * localStorage is unavailable (e.g. SSR context).
 *
 * @param merchantAddress - The SUI wallet address of the merchant.
 */
export function getDailyTxCount(merchantAddress: string): number {
  if (typeof localStorage === 'undefined') return 0;

  const raw = localStorage.getItem(buildKey(merchantAddress));
  if (raw === null) return 0;

  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Increment today's stamp-transaction counter for a merchant by 1.
 *
 * No-op when localStorage is unavailable (e.g. SSR context).
 *
 * @param merchantAddress - The SUI wallet address of the merchant.
 */
export function incrementDailyTxCount(merchantAddress: string): void {
  if (typeof localStorage === 'undefined') return;

  const current = getDailyTxCount(merchantAddress);
  localStorage.setItem(buildKey(merchantAddress), String(current + 1));
}

/**
 * Return true when the merchant has reached or exceeded the daily limit (>= 50).
 *
 * @param merchantAddress - The SUI wallet address of the merchant.
 */
export function isAtDailyLimit(merchantAddress: string): boolean {
  return getDailyTxCount(merchantAddress) >= DAILY_LIMIT;
}

/**
 * Return true when the merchant is approaching the daily limit (>= 40).
 *
 * Use this to show a soft warning before the hard block kicks in.
 *
 * @param merchantAddress - The SUI wallet address of the merchant.
 */
export function isNearDailyLimit(merchantAddress: string): boolean {
  return getDailyTxCount(merchantAddress) >= NEAR_LIMIT_THRESHOLD;
}
