"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";

/** Props for the WalletChip component. */
interface WalletChipProps {
  /** Full Sui wallet address (0x…). Truncated to `0xa81e…5f2c` for display. */
  address: string;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Compact wallet address pill with tap-to-copy interaction.
 *
 * Displays a truncated address (`first6...last4`) alongside a wallet icon.
 * Tapping copies the full address and briefly shows "Copied!" feedback.
 *
 * Uses Geist Mono for the address text to distinguish it from UI copy.
 *
 * @example
 * <WalletChip address="0xa81e1234567890abcdef1234567890abcdef5f2c" />
 */
export function WalletChip({ address, className = "" }: WalletChipProps) {
  const [copied, setCopied] = useState(false);

  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;

  function handleCopy() {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Wallet address ${address}. Tap to copy.`}
      className={[
        "tap-target inline-flex items-center gap-1.5",
        "transition-opacity duration-(--duration-micro) active:opacity-70",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        background: "var(--color-brand-subtle)",
        color: "var(--color-brand-dark)",
        borderRadius: "var(--radius-full)",
        padding: "4px 10px",
      }}
    >
      <Wallet size={14} aria-hidden="true" />
      <span
        style={{
          fontFamily: "var(--font-mono-stack)",
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: "0.02em",
          /* Prevent layout shift when text swaps to "Copied!" */
          minWidth: "6.5ch",
          textAlign: "left" as const,
        }}
      >
        {copied ? "Copied!" : truncated}
      </span>
    </button>
  );
}

export default WalletChip;
