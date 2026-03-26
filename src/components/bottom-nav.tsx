"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, CreditCard, Search, QrCode } from "lucide-react";
import { motion } from "framer-motion";
import type { ComponentType } from "react";

type NavTab = {
  href: string;
  icon: ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  label: string;
  exactMatch?: boolean;
};

const NAV_TABS: NavTab[] = [
  { href: "/customer", icon: Home, label: "Home", exactMatch: true },
  { href: "/customer/cards", icon: CreditCard, label: "Cards" },
  { href: "/customer/search", icon: Search, label: "Search" },
  { href: "/customer/scan", icon: QrCode, label: "Scan" },
];

/**
 * Floating liquid-glass bottom navigation — icons only, no labels.
 * Scan tab is rendered as a solid green pill (primary CTA).
 * Active non-scan tabs: icon turns green with a glow.
 *
 * Positioning: fixed, centered horizontally, 16px above the safe-area bottom.
 * Does NOT span the full width — it's a compact floating pill.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed z-50"
      style={{
        bottom: "max(calc(16px + env(safe-area-inset-bottom)), 28px)",
        left: "50%",
        transform: "translateX(-50%)",
      }}
    >
      <div
        className="liquid-surface flex items-center gap-1 px-4 py-2.5"
        style={{ borderRadius: "999px" }}
      >
        {NAV_TABS.map(({ href, icon: Icon, label, exactMatch }) => {
          const isActive = exactMatch
            ? pathname === href
            : pathname.startsWith(href);
          const isScan = href === "/customer/scan";

          if (isScan) {
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                aria-label={label}
              >
                <motion.div
                  whileTap={{ scale: 0.93 }}
                  className="flex items-center justify-center"
                  style={{
                    background: "#4ade80",
                    borderRadius: "14px",
                    width: "46px",
                    height: "36px",
                    boxShadow: "0 2px 12px rgba(74,222,128,0.4), 0 1px 0 rgba(255,255,255,0.3) inset",
                  }}
                >
                  <Icon size={18} strokeWidth={2.2} style={{ color: "#052e16" }} />
                </motion.div>
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="flex items-center justify-center"
                style={{ width: "44px", height: "36px" }}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  style={{
                    color: isActive ? "#4ade80" : "rgba(255,255,255,0.35)",
                    filter: isActive
                      ? "drop-shadow(0 0 6px rgba(74,222,128,0.6))"
                      : "none",
                    transition: "color 200ms ease, filter 200ms ease",
                  }}
                />
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
