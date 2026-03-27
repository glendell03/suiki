"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "./glass-card";
import { StampGrid } from "./stamp-grid";
import { ProgressBarStamps } from "./progress-bar-stamps";
import { Button } from "./ui/button";

/** Props for the MerchantCard component. */
interface MerchantCardProps {
  merchantName: string;
  category: string;
  /** URL for the merchant logo image. Falls back to emoji or Store icon. */
  logoUrl?: string;
  /** Emoji used as the merchant's logo fallback when logoUrl is absent. */
  emoji?: string;
  /** Stamps the customer has earned at this merchant. */
  filledStamps?: number;
  /** Total stamps required for a reward. */
  totalStamps?: number;
  /** Whether the card's stamp detail section is expanded. */
  isExpanded?: boolean;
  /** Called when the user taps the expand/collapse area. */
  onToggle?: () => void;
  /** Emoji rendered inside filled stamp slots. */
  stampEmoji?: string;
  /** Callback for the "Show QR" action button. */
  onShowQR?: () => void;
  className?: string;
}

/**
 * Stamp card for a single merchant, with collapsed and expanded views.
 *
 * Collapsed: shows the merchant logo (image or emoji fallback), name,
 * category, stamp count badge, and an animated chevron toggle.
 *
 * Expanded: reveals the StampGrid, segmented ProgressBarStamps, and a
 * "Show QR" button. Uses Framer Motion spring height animation instead
 * of the previous CSS grid-template-rows technique.
 */
export function MerchantCard({
  merchantName,
  category,
  logoUrl,
  emoji = "🏪",
  filledStamps = 0,
  totalStamps = 9,
  isExpanded = false,
  onToggle,
  stampEmoji = "⭐",
  onShowQR,
  className = "",
}: MerchantCardProps) {
  const [imgError, setImgError] = useState(false);
  const expandId = `merchant-detail-${merchantName.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <GlassCard padding="none" className={className}>
      {/* Collapsed header -- always visible */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={onToggle}
        role="button"
        aria-expanded={isExpanded}
        aria-controls={expandId}
      >
        {/* Merchant logo: raw <img> with emoji fallback */}
        <div
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--color-bg-elevated) overflow-hidden"
        >
          {logoUrl && !imgError ? (
            <img
              src={logoUrl}
              alt={merchantName}
              width={40}
              height={40}
              className="h-10 w-10 object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-lg" aria-hidden="true">
              {emoji}
            </span>
          )}
        </div>

        {/* Merchant info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-(--color-text-primary)">
            {merchantName}
          </p>
          <p className="truncate text-sm text-(--color-text-secondary)">
            {category}
          </p>
        </div>

        {/* Stamp count badge (collapsed only) */}
        {!isExpanded && (
          <span className="shrink-0 text-sm font-semibold text-(--color-accent-loyalty)">
            {filledStamps}/{totalStamps}
          </span>
        )}

        {/* Chevron -- rotates 180deg when expanded */}
        {onToggle && (
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0 text-(--color-text-secondary)"
          >
            <ChevronDown size={20} aria-hidden={true} />
          </motion.div>
        )}
      </motion.div>

      {/* Expandable content -- transform-only animation (no layout thrash) */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={expandId}
            key="expanded"
            initial={{ opacity: 0, scaleY: 0.92 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ transformOrigin: "top", overflow: "hidden" }}
          >
            <div className="flex flex-col gap-3 px-4 pb-4">
              <StampGrid
                total={totalStamps}
                earned={filledStamps}
                size="sm"
              />

              <ProgressBarStamps
                total={totalStamps}
                filled={filledStamps}
                showLabel
              />

              {/* Show QR action -- right-aligned */}
              <div className="flex justify-end">
                <Button
                  variant="loyalty"
                  onClick={onShowQR}
                  className="rounded-full px-4 py-2 text-sm"
                >
                  Show QR
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

export default MerchantCard;
