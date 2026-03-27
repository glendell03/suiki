"use client";

import { motion } from "framer-motion";

/** Props for the StepIndicator component. */
interface StepIndicatorProps {
  /** Total number of steps. */
  steps: number;
  /** Currently active step (1-based). */
  current: number;
}

/**
 * Horizontal dot-row progress indicator for multi-step flows.
 *
 * - Completed (< current): solid `--color-brand` circle, 8px
 * - Current: `--color-brand` pill that expands to 20×8px via Motion layoutId
 * - Pending (> current): `--color-border` circle, 8px
 *
 * @example
 * // Step 2 of 4
 * <StepIndicator steps={4} current={2} />
 */
export function StepIndicator({ steps, current }: StepIndicatorProps) {
  const clamped = Math.min(Math.max(1, current), steps);

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={1}
      aria-valuemax={steps}
      aria-label={`Step ${clamped} of ${steps}`}
      className="flex items-center justify-center gap-1.5"
    >
      {Array.from({ length: steps }, (_, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < clamped;
        const isCurrent = stepNum === clamped;

        return (
          <motion.div
            key={stepNum}
            layout
            {...(isCurrent ? { layoutId: "step-indicator-active" } : {})}
            className="rounded-full"
            animate={{
              width: isCurrent ? 20 : 8,
              height: 8,
              background:
                isCurrent || isCompleted
                  ? "var(--color-brand)"
                  : "var(--color-border)",
            }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

export default StepIndicator;
