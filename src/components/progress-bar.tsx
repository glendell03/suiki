"use client";

import { motion } from "framer-motion";

/** Props for the ProgressBar component. */
interface ProgressBarProps {
  /**
   * Fill ratio from 0 to 1 (e.g. 0.7 = 70%).
   * Values outside this range are clamped.
   */
  value: number;
  /** Height of the bar track in pixels. @default 4 */
  height?: number;
  /**
   * Animate the fill from 0 → value on mount.
   * @default true
   */
  animated?: boolean;
  /**
   * Show a gold milestone dot at the 100% mark.
   * The dot glows when value >= 1.
   * @default false
   */
  showMilestone?: boolean;
  className?: string;
}

/**
 * Smooth animated progress bar for stamp card fill.
 *
 * Track: `--color-border` fill, full-width, pill-shaped.
 * Fill: `--color-loyalty` amber, animates via Framer Motion scaleX on mount.
 * Milestone dot: 8px circle at the right edge, glows amber when complete.
 *
 * @example
 * <ProgressBar value={0.7} height={4} showMilestone />
 */
export function ProgressBar({
  value,
  height = 4,
  animated = true,
  showMilestone = false,
  className = "",
}: ProgressBarProps) {
  const clamped = Math.min(Math.max(0, value), 1);
  const isComplete = clamped >= 1;

  return (
    <div
      className={["relative w-full", className].filter(Boolean).join(" ")}
      style={{ height }}
    >
      {/* Track */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: "var(--color-border)" }}
      />

      {/* Fill */}
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full origin-left"
        style={{ background: "var(--color-loyalty)" }}
        initial={animated ? { scaleX: 0 } : { scaleX: clamped }}
        animate={{ scaleX: clamped }}
        transition={
          animated
            ? { type: "spring", stiffness: 200, damping: 30, delay: 0.2 }
            : { duration: 0 }
        }
        aria-hidden="true"
      />

      {/* Milestone dot */}
      {showMilestone && (
        <div
          className="absolute top-1/2 right-0 -translate-y-1/2 rounded-full"
          style={{
            width: 8,
            height: 8,
            background: "var(--color-loyalty)",
            boxShadow: isComplete
              ? "0 0 0 3px var(--color-loyalty-subtle), 0 0 8px rgba(217,119,6,0.5)"
              : "none",
            transition: "box-shadow 300ms ease",
          }}
          aria-hidden="true"
        />
      )}

      {/* Accessible label */}
      <span className="sr-only">
        {Math.round(clamped * 100)}% complete
      </span>
    </div>
  );
}

export default ProgressBar;
