"use client";

import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

interface InputProps extends ComponentPropsWithoutRef<"input"> {
  /** Optional label text rendered above the input. */
  label?: string;
  /** Error message rendered below the input when present. */
  error?: string;
}

/**
 * Accessible text input that forwards refs and accepts all native HTML input
 * attributes. Renders an optional label and inline error message.
 *
 * @example
 * <Input label="Email" type="email" placeholder="you@example.com" />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className = "", ...rest },
  ref
) {
  // Derive an id for label association when not explicitly provided
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-slate-300"
        >
          {label}
        </label>
      )}

      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={[
          "rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5",
          "text-sm text-white placeholder:text-slate-500",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
          "disabled:pointer-events-none disabled:opacity-50",
          error ? "border-red-500 focus:ring-red-500" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      />

      {error && (
        <p id={`${inputId}-error`} className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
