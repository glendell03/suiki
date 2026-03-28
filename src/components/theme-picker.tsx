"use client";

/**
 * ThemePicker -- horizontal scrollable row of stamp theme options.
 * Shows all themes (free + premium). Premium locked themes display a lock icon + price.
 * Clicking a locked theme triggers the onUnlock callback instead of selection.
 */

import { Lock } from "lucide-react";
import { STAMP_THEMES, isThemeFree } from "@/lib/stamp-themes";
import { StampSlot } from "@/components/stamp-slot";
import { motion } from "framer-motion";

interface ThemePickerProps {
  /** Currently selected theme ID. */
  value: number;
  onChange: (themeId: number) => void;
  /**
   * Set of premium theme IDs the merchant has already unlocked.
   * Free themes (0-5) are always selectable regardless of this set.
   */
  unlockedPremiumThemes?: Set<number>;
  /**
   * Called when a locked premium theme is tapped.
   * Parent should open the purchase sheet.
   */
  onUnlock?: (themeId: number) => void;
}

export function ThemePicker({
  value,
  onChange,
  unlockedPremiumThemes = new Set(),
  onUnlock,
}: ThemePickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <p
        className="text-[13px] font-semibold text-(--color-text-secondary)"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Stamp Style
      </p>

      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
        {STAMP_THEMES.map((theme) => {
          const isSelected = value === theme.id;
          const isLocked = theme.isPremium && !unlockedPremiumThemes.has(theme.id);

          function handleClick() {
            if (isLocked) {
              onUnlock?.(theme.id);
            } else {
              onChange(theme.id);
            }
          }

          return (
            <button
              key={theme.id}
              type="button"
              onClick={handleClick}
              aria-label={
                isLocked
                  ? `Unlock ${theme.name} for ${theme.isPremium ? theme.priceSui : 0} SUI`
                  : `Select ${theme.name} stamp style`
              }
              aria-pressed={!isLocked && isSelected}
              className="tap-target flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div
                className="relative flex items-center justify-center rounded-full transition-all"
                style={{
                  width: 52,
                  height: 52,
                  background: isLocked ? "var(--color-surface)" : isSelected ? theme.bgColor : "var(--color-surface)",
                  border: isSelected && !isLocked
                    ? `2px solid ${theme.inkColor}`
                    : "2px solid var(--color-border)",
                  boxShadow: isSelected && !isLocked ? `0 0 0 3px ${theme.inkColor}22` : "none",
                  opacity: isLocked ? 0.55 : 1,
                }}
              >
                <StampSlot earned={!isLocked} themeId={theme.id} size={38} />

                {/* Lock overlay for premium locked */}
                {isLocked && (
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded-full"
                    style={{ background: "rgba(255,255,255,0.7)" }}
                  >
                    <Lock size={14} className="text-(--color-text-muted)" />
                  </div>
                )}

                {/* Selected checkmark */}
                {isSelected && !isLocked && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white"
                    style={{
                      width: 16,
                      height: 16,
                      background: theme.inkColor,
                      fontSize: 9,
                      fontWeight: "bold",
                    }}
                  >
                    ✓
                  </motion.div>
                )}

                {/* Price badge for premium locked */}
                {isLocked && theme.isPremium && (
                  <div
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-white"
                    style={{
                      background: "var(--color-loyalty)",
                      fontSize: 8,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {theme.priceSui} SUI
                  </div>
                )}
              </div>

              <p
                className="text-[10px] text-center leading-tight"
                style={{
                  color: isLocked
                    ? "var(--color-text-muted)"
                    : isSelected
                      ? theme.inkColor
                      : "var(--color-text-muted)",
                  fontWeight: isSelected && !isLocked ? 600 : 400,
                  maxWidth: 52,
                }}
              >
                {theme.name.split(" ")[0]}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
