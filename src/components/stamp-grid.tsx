"use client";

import { Gift } from "lucide-react";
import { motion } from "framer-motion";

interface StampGridProps {
  /** Total number of stamp slots (including the reward slot). */
  totalSlots: number;
  /** How many slots are filled. */
  filledSlots: number;
  /** Emoji shown inside filled slots. Defaults to a star. */
  stampEmoji?: string;
  /** Visual size -- affects slot dimensions. */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: { slot: 36, icon: 14, text: "text-base" },
  md: { slot: 44, icon: 16, text: "text-xl" },
  lg: { slot: 52, icon: 18, text: "text-2xl" },
};

/**
 * StampGrid -- circular bordered stamp slots.
 *
 * Slot types:
 *   Filled  -- amber border + background, merchant emoji inside
 *   Empty   -- dashed green border, transparent background
 *   Reward  -- last slot always; green border + Gift icon (Lucide)
 *
 * The reward slot is always the last slot regardless of fill state.
 * Stamps animate in with a spring scale when first rendered.
 *
 * Layout: 5 columns, wraps to next row automatically.
 *
 * Colors use inline styles (slot colors are visualization data, not design tokens).
 */
export function StampGrid({
  totalSlots,
  filledSlots,
  stampEmoji = "⭐",
  size = "md",
  className = "",
}: StampGridProps) {
  const { slot, icon, text } = SIZE_MAP[size];
  const rewardIndex = totalSlots - 1;

  return (
    <div
      className={["grid gap-2", className].filter(Boolean).join(" ")}
      style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
      role="status"
      aria-label={`${filledSlots} of ${totalSlots} stamps collected`}
    >
      {Array.from({ length: totalSlots }, (_, i) => {
        const isReward = i === rewardIndex;
        const isFilled = i < filledSlots && !isReward;

        if (isReward) {
          return (
            <motion.div
              key={i}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: i * 0.04,
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
              className="flex items-center justify-center rounded-full"
              style={{
                width: slot,
                height: slot,
                border: "1.5px solid rgba(74,222,128,0.4)",
                background: "rgba(74,222,128,0.08)",
              }}
              aria-label="Reward slot"
            >
              <Gift
                size={icon}
                style={{ color: "var(--color-primary)" }}
                strokeWidth={1.8}
                aria-hidden={true}
              />
            </motion.div>
          );
        }

        if (isFilled) {
          return (
            <motion.div
              key={i}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: i * 0.04,
                type: "spring",
                stiffness: 500,
                damping: 28,
              }}
              className={["flex items-center justify-center rounded-full", text].join(
                " ",
              )}
              style={{
                width: slot,
                height: slot,
                border: "1.5px solid rgba(245,158,11,0.5)",
                background: "rgba(245,158,11,0.12)",
              }}
              aria-label={`Stamp ${i + 1} collected`}
            >
              {stampEmoji}
            </motion.div>
          );
        }

        return (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: slot,
              height: slot,
              border: "1.5px dashed rgba(74,222,128,0.2)",
              background: "transparent",
            }}
            aria-label={`Stamp slot ${i + 1} empty`}
          />
        );
      })}
    </div>
  );
}

export default StampGrid;
