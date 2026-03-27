'use client';

import { ProgressBarStamps } from '@/components/progress-bar-stamps';

interface StampProgressProps {
  /** Number of stamps the customer currently holds on this card. */
  current: number;
  /** Total stamps required before the customer can redeem. */
  required: number;
}

/**
 * StampProgress — visual representation of stamp card progress.
 *
 * Delegates rendering to the segmented ProgressBarStamps component, which
 * shows pill segments for each stamp slot. A numeric label is always shown
 * below the bar.
 */
export function StampProgress({ current, required }: StampProgressProps) {
  return (
    <ProgressBarStamps
      total={required}
      filled={current}
      showLabel
    />
  );
}
