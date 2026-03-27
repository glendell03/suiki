"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ComponentType } from "react";

/** Props for the QuickAction chip component. */
interface QuickActionProps {
  /** Lucide icon component. */
  icon: ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  /** Short action label (e.g. "Scan QR", "All Cards"). */
  label: string;
  /** Navigation destination. */
  href: string;
  /**
   * Visual variant:
   * - `default` — white chip with border
   * - `primary` — solid `--color-brand` chip (use for Scan QR)
   */
  variant?: "default" | "primary";
}

/**
 * Horizontal icon+label chip for quick navigation.
 *
 * Used in the Customer Home quick actions row.
 * The `primary` variant (used for Scan QR) has a solid blue fill.
 *
 * @example
 * <QuickAction icon={ScanLine} label="Scan QR" href="/customer/scan" variant="primary" />
 * <QuickAction icon={CreditCard} label="All Cards" href="/customer/cards" />
 */
export function QuickAction({ icon: Icon, label, href, variant = "default" }: QuickActionProps) {
  const isPrimary = variant === "primary";

  return (
    <Link href={href} aria-label={label} className="tap-target">
      <motion.div
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="inline-flex items-center gap-2 rounded-full"
        style={{
          padding: "10px 16px",
          background: isPrimary ? "var(--color-brand)" : "var(--color-surface)",
          border: isPrimary ? "none" : "1px solid var(--color-border)",
          boxShadow: "var(--shadow-sm)",
          minHeight: 44,
        }}
      >
        <Icon
          size={20}
          strokeWidth={1.8}
          style={{ color: isPrimary ? "var(--color-text-on-brand)" : "var(--color-text-primary)" }}
        />
        <span
          className="text-[13px] font-semibold whitespace-nowrap"
          style={{ color: isPrimary ? "var(--color-text-on-brand)" : "var(--color-text-primary)" }}
        >
          {label}
        </span>
      </motion.div>
    </Link>
  );
}

export default QuickAction;
