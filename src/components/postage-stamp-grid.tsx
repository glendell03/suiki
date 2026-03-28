"use client";

import { Check, Gift } from "lucide-react";
import { motion } from "framer-motion";

interface PostageStampGridProps {
  /** Number of stamps already earned. */
  earned: number;
  /** Total stamps required to complete the card. */
  total: number;
  /**
   * When true, the most recently earned stamp plays a spring bounce animation.
   * @default false
   */
  animateNewStamp?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Stamp geometry constants
// ---------------------------------------------------------------------------

const S = 60;          // stamp size (px)
const R = 3.5;         // perforation hole radius (px)
const HOLES = 3;       // holes per side
const INNER = 8;       // inner border inset (px)

/**
 * Generates an SVG path string for a square stamp with perforated edges.
 * Arcs bite INTO the stamp on all four sides.
 */
function perforatedPath(W: number, H: number, r: number, holes: number): string {
  const hS = W / (holes + 1); // horizontal hole spacing
  const vS = H / (holes + 1); // vertical hole spacing

  let d = `M 0 0`;

  // Top edge (L → R) — arcs curve downward (into stamp), sweep=1
  for (let i = 1; i <= holes; i++) {
    const x = i * hS;
    d += ` L ${x - r} 0 A ${r} ${r} 0 0 1 ${x + r} 0`;
  }
  d += ` L ${W} 0`;

  // Right edge (T → B) — arcs curve leftward (into stamp), sweep=0
  for (let i = 1; i <= holes; i++) {
    const y = i * vS;
    d += ` L ${W} ${y - r} A ${r} ${r} 0 0 0 ${W} ${y + r}`;
  }
  d += ` L ${W} ${H}`;

  // Bottom edge (R → L) — arcs curve upward (into stamp), sweep=1
  for (let i = holes; i >= 1; i--) {
    const x = i * hS;
    d += ` L ${x + r} ${H} A ${r} ${r} 0 0 1 ${x - r} ${H}`;
  }
  d += ` L 0 ${H}`;

  // Left edge (B → T) — arcs curve rightward (into stamp), sweep=0
  for (let i = holes; i >= 1; i--) {
    const y = i * vS;
    d += ` L 0 ${y + r} A ${r} ${r} 0 0 0 0 ${y - r}`;
  }

  return d + " Z";
}

const STAMP_PATH = perforatedPath(S, S, R, HOLES);

// ---------------------------------------------------------------------------
// Single stamp slot
// ---------------------------------------------------------------------------

interface StampSlotProps {
  index: number;
  isEarned: boolean;
  isReward: boolean;
  isNew: boolean;
}

function StampSlot({ isEarned, isReward, isNew }: StampSlotProps) {
  const bodyFill =
    isReward && isEarned
      ? "var(--color-loyalty)"
      : isEarned
        ? "var(--color-brand)"
        : "var(--color-surface)";

  const innerStroke = isEarned
    ? "rgba(255,255,255,0.35)"
    : "var(--color-border)";

  const iconColor = isEarned ? "white" : "var(--color-text-muted)";

  const slot = (
    <div
      className="relative flex-shrink-0"
      style={{
        width: S,
        height: S,
        filter: isEarned
          ? "drop-shadow(0 2px 6px rgba(0,0,0,0.18))"
          : "drop-shadow(0 1px 2px rgba(0,0,0,0.06))",
      }}
    >
      {/* Stamp body */}
      <svg
        width={S}
        height={S}
        viewBox={`0 0 ${S} ${S}`}
        aria-hidden="true"
        className="absolute inset-0"
      >
        <path d={STAMP_PATH} fill={bodyFill} />
        {/* Inner border line — classic stamp look */}
        <rect
          x={INNER}
          y={INNER}
          width={S - INNER * 2}
          height={S - INNER * 2}
          rx={2}
          fill="none"
          stroke={innerStroke}
          strokeWidth={1}
        />
      </svg>

      {/* Icon overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isReward ? (
          <Gift
            size={20}
            strokeWidth={1.8}
            style={{ color: iconColor }}
            aria-hidden="true"
          />
        ) : isEarned ? (
          <Check
            size={20}
            strokeWidth={2.8}
            style={{ color: "white" }}
            aria-hidden="true"
          />
        ) : null}
      </div>
    </div>
  );

  if (isNew) {
    return (
      <motion.div
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        {slot}
      </motion.div>
    );
  }

  return slot;
}

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

/**
 * A flex-wrap grid of postage stamp shaped slots.
 *
 * Earned slots: solid brand-color fill + white checkmark.
 * Reward slot (last): gift icon; gold fill when earned.
 * Unearned slots: surface fill with border inner line.
 *
 * @example
 * <PostageStampGrid earned={5} total={8} animateNewStamp />
 */
export function PostageStampGrid({
  earned,
  total,
  animateNewStamp = false,
  className = "",
}: PostageStampGridProps) {
  const clampedEarned = Math.min(Math.max(0, earned), total);
  const newStampIndex = clampedEarned - 1;

  return (
    <div
      role="list"
      aria-label={`${clampedEarned} of ${total} stamps earned`}
      className={["flex flex-wrap", className].filter(Boolean).join(" ")}
      style={{ gap: 8 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          role="listitem"
          aria-label={
            i === total - 1
              ? `Reward slot: ${i < clampedEarned ? "unlocked" : "locked"}`
              : `Stamp ${i + 1}: ${i < clampedEarned ? "earned" : "empty"}`
          }
        >
          <StampSlot
            index={i}
            isEarned={i < clampedEarned}
            isReward={i === total - 1}
            isNew={animateNewStamp && i === newStampIndex}
          />
        </div>
      ))}
    </div>
  );
}

export default PostageStampGrid;
