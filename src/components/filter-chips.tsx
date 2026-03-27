"use client";

import { motion } from "framer-motion";

/** Single option for FilterChips. */
interface FilterOption {
  label: string;
  value: string;
}

/** Props for the FilterChips component. */
interface FilterChipsProps {
  /**
   * Unique identifier for this FilterChips instance.
   * Scopes the Motion `layoutId` so multiple FilterChips on the same page
   * don't animate into each other.
   */
  id: string;
  /** Array of selectable options. */
  options: FilterOption[];
  /** Currently selected value. */
  value: string;
  /** Called when the user selects a different option. */
  onChange: (value: string) => void;
}

/**
 * Horizontally scrolling filter chip row with animated active indicator.
 *
 * The active chip background slides between options via Framer Motion's
 * `layoutId` — smooth shared-layout animation, spring-driven.
 *
 * @example
 * <FilterChips
 *   id="cards-filter"
 *   options={[
 *     { label: "All", value: "all" },
 *     { label: "Active", value: "active" },
 *     { label: "Near Reward", value: "near" },
 *   ]}
 *   value={filter}
 *   onChange={setFilter}
 * />
 */
export function FilterChips({ id, options, value, onChange }: FilterChipsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter options"
      className="flex gap-2 overflow-x-auto scrollbar-none px-4 py-2"
    >
      {options.map((opt) => {
        const isActive = opt.value === value;

        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className="tap-target relative flex-shrink-0 rounded-full px-4 py-2 min-h-[36px]"
            style={{
              border: isActive ? "none" : "1px solid var(--color-border)",
              background: isActive ? "transparent" : "var(--color-surface)",
            }}
          >
            {/* Sliding active background */}
            {isActive && (
              <motion.div
                layoutId={`filter-chip-active-${id}`}
                className="absolute inset-0 rounded-full"
                style={{ background: "var(--color-brand)" }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}

            <motion.span
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="relative z-10 text-[13px] font-semibold"
              style={{
                color: isActive ? "white" : "var(--color-text-secondary)",
                transition: "color 150ms ease",
              }}
            >
              {opt.label}
            </motion.span>
          </button>
        );
      })}
    </div>
  );
}

export default FilterChips;
