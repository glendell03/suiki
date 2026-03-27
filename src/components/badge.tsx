import type { ReactNode } from "react";

/** Visual variant for the Badge. */
type BadgeVariant = "active" | "completed" | "new" | "reward" | "muted";

/** Props for the Badge component. */
interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
}

/** Tailwind + inline-style config per variant. */
const VARIANT_STYLES: Record<BadgeVariant, { bg: string; color: string }> = {
  active:    { bg: "var(--color-brand-subtle)",   color: "var(--color-brand-dark)" },
  completed: { bg: "#dcfce7",                      color: "#166534" },
  new:       { bg: "var(--color-loyalty-subtle)", color: "var(--color-loyalty-dark)" },
  reward:    { bg: "var(--color-loyalty)",         color: "white" },
  muted:     { bg: "var(--color-bg-base)",         color: "var(--color-text-muted)" },
};

/**
 * Small pill badge for status labels, reward indicators, and categories.
 *
 * Five variants cover all use cases in V2:
 * - `active`    — sky blue chip (active program, active filter)
 * - `completed` — green chip (card complete, reward redeemed)
 * - `new`       — amber chip (new program, recent stamp)
 * - `reward`    — solid amber (reward ready CTA)
 * - `muted`     — gray chip (secondary info, timestamps)
 *
 * @example
 * <Badge variant="reward">★ Reward ready</Badge>
 * <Badge variant="active">Active</Badge>
 */
export function Badge({ variant, children, className = "" }: BadgeProps) {
  const { bg, color } = VARIANT_STYLES[variant];

  return (
    <span
      className={[
        "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 min-w-[1.25rem]",
        "text-[11px] font-semibold tracking-wide leading-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ background: bg, color }}
    >
      {children}
    </span>
  );
}

export default Badge;
