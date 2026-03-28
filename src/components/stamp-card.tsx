"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StampSlot, ThemedStampGrid } from "./stamp-slot";
import { MerchantAvatar } from "./merchant-avatar";
import { BeautifulQR } from "./beautiful-qr";
import { getTheme } from "@/lib/stamp-themes";

function formatCardDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(date);
}

export interface StampCardProps {
  /** Theme ID (0–10). Controls the card's color palette and stamp style. */
  themeId: number;
  /** Merchant name shown in the card header. */
  merchantName: string;
  /** Reward description shown below the merchant name. */
  rewardDescription: string;
  /** Number of stamps already earned. */
  stampCount: number;
  /** Total stamps required to complete the card. */
  totalStamps: number;
  /** Optional merchant logo URL. */
  logoUrl?: string;
  /**
   * Called when the entire card is tapped.
   * When provided the card becomes a tappable nav target.
   */
  onTap?: () => void;
  /**
   * When true the most recently earned stamp plays a spring bounce entry.
   * @default false
   */
  animateNewStamp?: boolean;
  /**
   * Encoded QR value for the Apple Wallet-style footer.
   * When provided a QR code and last-stamp date are shown at the bottom of the card.
   */
  qrValue?: string;
  /**
   * ISO date of the last stamp, shown in the card footer next to the QR code.
   * Only used when `qrValue` is provided.
   */
  lastStampedAt?: string | null;
}

/**
 * StampCard — the single unified loyalty card component.
 *
 * Matches the exact look and feel of the stamp-showcase VariantCard:
 * themed background, header with merchant identity + stamp preview,
 * stamp grid with spring animations, animated completion banner,
 * and a card-thud animation when a new stamp is earned.
 *
 * Used on every page that displays a loyalty card.
 */
export function StampCard({
  themeId,
  merchantName,
  rewardDescription,
  stampCount,
  totalStamps,
  logoUrl,
  onTap,
  animateNewStamp = false,
  qrValue,
  lastStampedAt,
}: StampCardProps) {
  const theme = getTheme(themeId);
  const clamped = Math.min(Math.max(0, stampCount), totalStamps);
  const isComplete = clamped >= totalStamps;
  const remaining = totalStamps - clamped;

  // Card thud (y bounce) triggers when a new stamp is added
  const [thudKey, setThudKey] = useState(0);
  const prevCountRef = useRef(stampCount);
  useEffect(() => {
    if (stampCount > prevCountRef.current) {
      setThudKey((k) => k + 1);
    }
    prevCountRef.current = stampCount;
  }, [stampCount]);

  return (
    <motion.div
      animate={thudKey > 0 ? { y: [0, -4, 2, -1, 0] } : {}}
      transition={{ duration: 0.38, ease: "easeOut" }}
      whileTap={onTap ? { scale: 0.98 } : undefined}
      onClick={onTap}
      role={onTap ? "button" : undefined}
      tabIndex={onTap ? 0 : undefined}
      onKeyDown={
        onTap
          ? (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") onTap();
            }
          : undefined
      }
      className={[
        "w-full rounded-(--radius-xl) overflow-hidden",
        onTap ? "tap-target cursor-pointer" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        background: theme.bgColor,
        border: `1.5px solid ${theme.inkColor}22`,
        boxShadow: `0 2px 12px ${theme.fillColor}18`,
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ borderBottom: `1px solid ${theme.inkColor}18` }}
      >
        <MerchantAvatar
          {...(logoUrl ? { logoUrl } : {})}
          name={merchantName}
          size={36}
        />

        <div className="min-w-0 flex-1">
          <p
            className="text-[14px] font-bold truncate leading-snug"
            style={{ color: theme.inkColor, fontFamily: "var(--font-display)" }}
          >
            {merchantName}
          </p>
          <p
            className="text-[11px] mt-0.5 truncate"
            style={{ color: theme.inkColor, opacity: 0.65 }}
          >
            {rewardDescription}
          </p>
        </div>

        {/* Stamp preview — always shows the earned/filled state */}
        <div className="shrink-0" style={{ opacity: 0.9 }}>
          <StampSlot earned size={40} themeId={themeId} />
        </div>
      </div>

      {/* ── Stamp grid ─────────────────────────────────────── */}
      <div className="px-4 py-4">
        <ThemedStampGrid
          earned={clamped}
          total={totalStamps}
          themeId={themeId}
          animateNewStamp={animateNewStamp}
        />

        {/* Completion celebration banner */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 text-center py-2 rounded-full text-[12px] font-semibold"
              style={{ background: theme.fillColor, color: theme.textColor }}
            >
              🎉 Reward ready!
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress count */}
        <p
          className="mt-3 text-[12px]"
          style={{ color: theme.inkColor, opacity: 0.55 }}
        >
          {clamped}/{totalStamps} stamps
          {!isComplete && ` · ${remaining} more to reward`}
        </p>
      </div>

      {/* ── Apple Wallet footer — last stamp metadata + QR ─── */}
      {qrValue && (
        <>
          <div style={{ height: 1, background: `${theme.inkColor}18` }} />

          {/* Metadata row */}
          <div className="px-4 pt-3 pb-1 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <p
                className="text-[10px] uppercase tracking-widest font-medium"
                style={{ color: theme.inkColor, opacity: 0.45 }}
              >
                Last stamp
              </p>
              <p
                className="text-[13px] font-semibold"
                style={{ color: theme.inkColor }}
              >
                {formatCardDate(lastStampedAt)}
              </p>
            </div>
            <p
              className="text-[10px] uppercase tracking-widest font-medium"
              style={{ color: theme.inkColor, opacity: 0.45 }}
            >
              Loyalty Card
            </p>
          </div>

          {/* QR code — centered, white tile, large enough to scan reliably */}
          <div className="px-4 pb-4 pt-2 flex flex-col items-center gap-2">
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "#ffffff",
                padding: 12,
                boxShadow: `0 2px 10px ${theme.inkColor}18`,
              }}
            >
              <BeautifulQR
                value={qrValue}
                size={200}
                foregroundColor="#111111"
                backgroundColor="#ffffff"
                radius={0}
                errorCorrectionLevel="Q"
              />
            </div>
            <p
              className="text-[11px] text-center"
              style={{ color: theme.inkColor, opacity: 0.45 }}
            >
              Show this to the merchant to earn a stamp
            </p>
          </div>
        </>
      )}
    </motion.div>
  );
}

export default StampCard;
