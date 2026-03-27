"use client";

import { Search, X } from "lucide-react";
import type { ChangeEvent, KeyboardEvent } from "react";

/** Props for the SearchBar component. */
interface SearchBarProps {
  /** Controlled input value. */
  value: string;
  /** Called on every keystroke with the new value. */
  onChange: (value: string) => void;
  /** Placeholder text. @default "Search merchants..." */
  placeholder?: string;
  /** Focus input on mount. @default false */
  autoFocus?: boolean;
  /** Called when Enter is pressed. */
  onSubmit?: (value: string) => void;
  className?: string;
}

/**
 * Search input bar matching the V2 spec.
 *
 * White surface, `--color-border` border, `--radius-xl`.
 * Focus state: `--color-brand` border + subtle shadow.
 * Clear (×) button appears when value is non-empty.
 *
 * @example
 * <SearchBar value={query} onChange={setQuery} placeholder="Find a merchant..." />
 */
export function SearchBar({
  value,
  onChange,
  placeholder = "Search merchants...",
  autoFocus = false,
  onSubmit,
  className = "",
}: SearchBarProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value);
  const handleClear = () => onChange("");
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onSubmit?.(value);
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(value);
      }}
      className={[
        "flex items-center gap-3 px-4",
        "bg-(--color-surface) border border-(--color-border) rounded-(--radius-xl)",
        "transition-[border-color,box-shadow] duration-(--duration-fast)",
        "focus-within:border-(--color-brand) focus-within:shadow-[0_0_0_3px_var(--color-brand-subtle)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ height: 48 }}
    >
      {/* Screen-reader label */}
      <label htmlFor="search-input" className="sr-only">
        {placeholder}
      </label>

      <Search
        size={16}
        aria-hidden="true"
        style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
      />

      <input
        id="search-input"
        type="search"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="flex-1 min-w-0 bg-transparent text-[15px] text-(--color-text-primary)
                   placeholder:text-(--color-text-muted) outline-none border-none
                   caret-(--color-brand)"
      />

      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="tap-target flex items-center justify-center shrink-0"
          style={{
            width: 28,
            height: 28,
            color: "var(--color-text-muted)",
          }}
        >
          <X size={16} />
        </button>
      )}
    </form>
  );
}

export default SearchBar;
