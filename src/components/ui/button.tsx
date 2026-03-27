"use client";

import type { ComponentPropsWithoutRef } from "react";

/** Visual style variants for the Button component. */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "loyalty";

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  /** Controls the visual weight and color of the button. Defaults to "primary". */
  variant?: ButtonVariant;
}

/**
 * Tailwind classes indexed by variant. Defined outside the component
 * to avoid recreation on every render.
 *
 * Variants:
 * - primary   — black CTA on white background
 * - secondary — light gray surface with border
 * - ghost     — transparent with border, for low-emphasis actions
 * - loyalty   — amber pill for stamp-card CTAs (e.g. "Show QR", reward redemption)
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-(--color-primary) text-white hover:opacity-80 focus-visible:ring-(--color-primary)",
  secondary:
    "bg-(--color-bg-elevated) text-(--color-text-primary) border border-(--color-border) hover:bg-(--color-bg-surface) focus-visible:ring-(--color-border-strong)",
  ghost:
    "bg-transparent border border-(--color-border) text-(--color-text-primary) hover:bg-(--color-bg-surface) focus-visible:ring-(--color-border-strong)",
  loyalty:
    "rounded-full bg-(--color-accent-loyalty) text-white font-semibold hover:opacity-90 focus-visible:ring-(--color-accent-loyalty)",
};

/**
 * Accessible button with three visual variants.
 * Forwards all native HTML button attributes including `disabled`, `type`, etc.
 *
 * @example
 * <Button variant="primary" onClick={handleClick}>Continue</Button>
 */
export function Button({
  variant = "primary",
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const variantClasses = VARIANT_CLASSES[variant];

  return (
    <button
      {...rest}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2",
        "rounded-xl px-6 py-3 text-sm font-semibold",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClasses,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}
