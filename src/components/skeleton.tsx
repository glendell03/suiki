/** Variant shapes for the Skeleton loading placeholder. */
type SkeletonVariant = "text" | "avatar" | "card" | "stamp-row";

/** Props for the Skeleton component. */
interface SkeletonProps {
  variant: SkeletonVariant;
  /** Additional Tailwind classes for sizing overrides. */
  className?: string;
}

/**
 * Pulsing placeholder shown while content is loading.
 *
 * Uses a CSS `@keyframes` pulse animation (opacity 1 → 0.5 → 1, 1.2s).
 * No layout shift — each variant matches the dimensions of the real content.
 *
 * Variants:
 * - `text`      — single line placeholder (100% × 14px)
 * - `avatar`    — circle (use className to set size, default 40px)
 * - `card`      — full StampCard tile skeleton with inner regions
 * - `stamp-row` — row of 5 stamp circles
 *
 * @example
 * <Skeleton variant="card" />
 * <Skeleton variant="avatar" className="w-12 h-12" />
 */
export function Skeleton({ variant, className = "" }: SkeletonProps) {
  const base = "bg-(--color-border) animate-pulse";

  if (variant === "text") {
    return (
      <div
        className={["rounded-(--radius-sm) h-3.5 w-full", base, className]
          .filter(Boolean)
          .join(" ")}
      />
    );
  }

  if (variant === "avatar") {
    return (
      <div
        className={[
          "rounded-full shrink-0",
          "w-10 h-10", // default size; override with className
          base,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
    );
  }

  if (variant === "stamp-row") {
    return (
      <div className={["flex gap-1.5", className].filter(Boolean).join(" ")}>
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={["rounded-full w-4 h-4 shrink-0", base].join(" ")}
          />
        ))}
      </div>
    );
  }

  // card variant
  return (
    <div
      className={[
        "w-full rounded-(--radius-xl) border border-(--color-border) bg-(--color-surface) p-4 flex flex-col gap-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" className="w-12 h-12" />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton variant="text" className="w-2/3" />
          <Skeleton variant="text" className="w-1/2" />
        </div>
      </div>
      {/* Progress bar */}
      <div className={["rounded-full h-1.5 w-full", base].join(" ")} />
    </div>
  );
}

export default Skeleton;
