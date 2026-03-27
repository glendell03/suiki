/** Props for the segmented stamp progress bar. */
interface ProgressBarStampsProps {
  /** Total number of segments (stamps required). */
  total: number;
  /** Number of filled (earned) segments. */
  filled: number;
  className?: string;
  /** When true, renders a "X/Y stamps" label below the bar. */
  showLabel?: boolean;
}

/**
 * Segmented progress bar for stamp cards.
 *
 * Renders `total` pill segments in a row with gaps. Filled segments use
 * the primary green; empty segments use the elevated surface color. Matches
 * the reference design — segmented rather than a continuous bar.
 *
 * @example
 * <ProgressBarStamps total={9} filled={4} showLabel />
 */
export function ProgressBarStamps({
  total,
  filled,
  className = "",
  showLabel = false,
}: ProgressBarStampsProps) {
  const clampedFilled = Math.min(Math.max(0, filled), total);

  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-valuenow={clampedFilled}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${clampedFilled} of ${total} stamps collected`}
        className="flex gap-1"
      >
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={[
              "h-2.5 flex-1 rounded-full transition-colors duration-300",
              i < clampedFilled
                ? "bg-(--color-primary)"
                : "bg-(--color-bg-elevated)",
            ].join(" ")}
          />
        ))}
      </div>

      {showLabel && (
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-xs text-(--color-text-secondary)">
            Progress
          </p>
          <p className="text-xs font-semibold text-(--color-accent-loyalty)">
            {clampedFilled}/{total} stamps
          </p>
        </div>
      )}
    </div>
  );
}

export default ProgressBarStamps;
