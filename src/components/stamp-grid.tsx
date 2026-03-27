"use client";

import { Check } from "lucide-react";
import { motion } from "framer-motion";

/** Props for the StampGrid component. */
interface StampGridProps {
  /** Number of stamps already earned. */
  earned: number;
  /** Total stamps required to complete the card. */
  total: number;
  /** Size variant — controls circle diameter and gap. @default "md" */
  size?: "sm" | "md" | "lg";
  /**
   * When true, the most recently earned stamp (index `earned - 1`)
   * plays a spring bounce entry animation.
   * @default false
   */
  animateNewStamp?: boolean;
  className?: string;
}

/** Circle size and gap per variant. */
const SIZE_MAP = {
  sm: { px: 10, gap: 4, checkSize: 6 },
  md: { px: 18, gap: 6, checkSize: 10 },
  lg: { px: 26, gap: 8, checkSize: 14 },
} as const;

/**
 * Horizontal-wrapping grid of stamp circles.
 *
 * Earned slots: solid `--color-loyalty` fill + white checkmark.
 * Unearned slots: transparent with `--color-border` 1.5px border.
 * Wraps at 5 items per row (flex-wrap).
 *
 * @example
 * <StampGrid earned={5} total={8} size="md" animateNewStamp />
 */
export function StampGrid({
  earned,
  total,
  size = "md",
  animateNewStamp = false,
  className = "",
}: StampGridProps) {
  const { px, gap, checkSize } = SIZE_MAP[size];
  const clampedEarned = Math.min(Math.max(0, earned), total);
  // The "new" stamp is the most recently earned (last filled slot)
  const newStampIndex = clampedEarned - 1;

  return (
    <div
      role="list"
      aria-label={`${clampedEarned} of ${total} stamps earned`}
      className={["flex flex-wrap", className].filter(Boolean).join(" ")}
      style={{ gap }}
    >
      {Array.from({ length: total }, (_, i) => {
        const isEarned = i < clampedEarned;
        const isNew = animateNewStamp && i === newStampIndex;

        const circle = (
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: px,
              height: px,
              background: isEarned ? "var(--color-loyalty)" : "transparent",
              border: isEarned ? "none" : "1.5px solid var(--color-border)",
            }}
          >
            {isEarned && (
              <Check
                size={checkSize}
                strokeWidth={2.5}
                style={{ color: "white" }}
                aria-hidden="true"
              />
            )}
          </div>
        );

        return (
          <div
            key={i}
            role="listitem"
            aria-label={
              i === total - 1
                ? "Reward slot"
                : `Stamp ${i + 1} of ${total}: ${isEarned ? "earned" : "empty"}`
            }
          >
            {isNew ? (
              <motion.div
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                {circle}
              </motion.div>
            ) : (
              circle
            )}
          </div>
        );
      })}
    </div>
  );
}

export default StampGrid;
