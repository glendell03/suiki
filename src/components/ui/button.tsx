"use client";

import type { ComponentPropsWithoutRef } from "react";

/** Visual style variants for the Button component. */
export type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  /** Controls the visual weight and color of the button. Defaults to "primary". */
  variant?: ButtonVariant;
}

/** Tailwind classes indexed by variant. Defined outside the component
 * to avoid recreation on every render. */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500",
  secondary:
    "bg-slate-700 text-white hover:bg-slate-600 focus-visible:ring-slate-500",
  ghost:
    "bg-transparent text-slate-200 hover:bg-slate-800 focus-visible:ring-slate-400",
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
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
