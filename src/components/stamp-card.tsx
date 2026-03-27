"use client";

import React from "react";
import { MerchantAvatar } from "./merchant-avatar";
import { StampGrid } from "./stamp-grid";
import { ProgressBar } from "./progress-bar";
import { motion } from "framer-motion";

/** Props for the StampCard component. */
interface StampCardProps {
  /** Unique program ID — used as the navigation target. */
  programId: string;
  /** Merchant display name. */
  merchantName: string;
  /** Loyalty program name (e.g. "Coffee Rewards"). */
  programName: string;
  /** Merchant logo URL — falls back to initials in MerchantAvatar. */
  logoUrl?: string;
  /** Customer's current stamp count. */
  stampCount: number;
  /** Total stamps needed for a reward. */
  totalStamps: number;
  /** Description of the reward (e.g. "Free coffee"). */
  rewardDescription: string;
  /**
   * Visual variant:
   * - `compact` — list tile (default)
   * - `featured` — home screen hero card, larger with StampGrid
   */
  variant?: "compact" | "featured";
  /** Tap handler — typically navigates to card detail. */
  onTap?: () => void;
}

/**
 * Stamp card component rendered in two sizes:
 *
 * **compact** — for the Cards list and Nearby Programs list.
 * Merchant avatar (48px), name, progress bar, stamp count label.
 *
 * **featured** — for the Customer Home hero slot.
 * Larger padding, 56px avatar, stamp grid row + progress bar.
 * Only the card with highest % progress should be shown as featured.
 *
 * @example
 * <StampCard
 *   programId="0x123"
 *   merchantName="Coffee Bean"
 *   programName="Loyalty Program"
 *   stampCount={7}
 *   totalStamps={10}
 *   rewardDescription="Free coffee"
 *   variant="featured"
 *   onTap={() => router.push(`/customer/cards/${programId}`)}
 * />
 */
export function StampCard({
  merchantName,
  programName,
  logoUrl,
  stampCount,
  totalStamps,
  rewardDescription,
  variant = "compact",
  onTap,
}: StampCardProps) {
  const clampedCount = Math.min(Math.max(0, stampCount), totalStamps);
  const progress = totalStamps > 0 ? clampedCount / totalStamps : 0;
  const isRewardReady = clampedCount >= totalStamps;
  const remaining = totalStamps - clampedCount;

  const isFeatured = variant === "featured";
  const avatarSize = isFeatured ? 56 : 48;
  const padding = isFeatured ? 20 : 16;
  const barHeight = isFeatured ? 6 : 4;

  return (
    <motion.div
      {...(onTap ? { whileTap: { scale: 0.98 } } : {})}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      onClick={onTap}
      {...(onTap ? { role: "button" as const, tabIndex: 0 } : {})}
      {...(onTap
        ? {
            onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.key === "Enter" || e.key === " ") onTap();
            },
          }
        : {})}
      className={[
        "w-full bg-(--color-surface) border border-(--color-border)",
        "rounded-(--radius-xl) flex flex-col gap-3",
        onTap ? "tap-target cursor-pointer" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ padding, boxShadow: isFeatured ? "var(--shadow-sheet)" : "none" }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        <MerchantAvatar
          {...(logoUrl ? { logoUrl } : {})}
          name={merchantName}
          size={avatarSize}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-(--color-text-primary)">
            {merchantName}
          </p>
          <p className="truncate text-[13px] text-(--color-text-secondary)">
            {programName}
          </p>
          {!isFeatured && (
            <p className="text-[13px] font-semibold text-(--color-text-muted) tabular-nums">
              {clampedCount} / {totalStamps} stamps
            </p>
          )}
        </div>

        {/* Reward ready badge — compact only */}
        {!isFeatured && isRewardReady && (
          <span
            className="shrink-0 rounded-full text-[11px] font-semibold px-2.5 py-0.5"
            style={{
              background: "var(--color-loyalty)",
              color: "white",
            }}
          >
            ★ Ready
          </span>
        )}
      </div>

      {/* StampGrid — featured only */}
      {isFeatured && (
        <StampGrid earned={clampedCount} total={totalStamps} size="sm" />
      )}

      {/* Progress row */}
      <div className="flex flex-col gap-1">
        <ProgressBar
          value={progress}
          height={barHeight}
          showMilestone={isRewardReady}
        />

        <div className="flex items-center justify-between">
          {isRewardReady ? (
            <p
              className="text-[12px] font-semibold"
              style={{ color: "var(--color-loyalty-dark)" }}
            >
              ★ Reward ready — {rewardDescription}
            </p>
          ) : (
            <p className="text-[12px] text-(--color-text-muted)">
              {remaining} more to reward
            </p>
          )}

          {isFeatured && (
            <p
              className="text-[12px] font-semibold tabular-nums"
              style={{ color: "var(--color-loyalty-dark)" }}
            >
              {clampedCount}/{totalStamps}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default StampCard;
