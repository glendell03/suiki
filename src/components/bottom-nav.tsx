"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { House, CreditCard, ScanLine, Compass } from "lucide-react";
import { motion } from "framer-motion";
import type { ComponentType } from "react";

type NavTab = {
  href: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties; "aria-hidden"?: boolean | "true" }>;
  label: string;
  ariaLabel: string;
  exactMatch?: boolean;
};

const NAV_TABS: NavTab[] = [
  { href: "/customer",        icon: House,       label: "Home",    ariaLabel: "Home",                exactMatch: true },
  { href: "/customer/cards",  icon: CreditCard,  label: "Cards",   ariaLabel: "My stamp cards" },
  { href: "/customer/scan",   icon: ScanLine,    label: "Scan",    ariaLabel: "Show my QR code" },
  { href: "/customer/search", icon: Compass,     label: "Explore", ariaLabel: "Search merchants" },
];

/**
 * Fixed bottom navigation bar for the customer section.
 *
 * Four tabs: Home · Cards · Scan · Explore.
 * The Scan tab always renders with a solid `--color-brand` pill background —
 * it is the primary repeating action and must always stand out.
 * Active non-scan tabs: icon + label in `--color-brand-dark`.
 * Inactive: `--color-text-muted`.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50
                 flex items-stretch justify-around
                 bg-(--color-surface) border-t border-(--color-border)"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        boxShadow: "var(--shadow-float)",
      }}
    >
      {NAV_TABS.map(({ href, icon: Icon, label, ariaLabel, exactMatch }) => {
        const isActive = exactMatch ? pathname === href : pathname.startsWith(href);
        const isScan = href === "/customer/scan";

        if (isScan) {
          return (
            <Link
              key={href}
              href={href}
              aria-label={ariaLabel}
              aria-current={isActive ? "page" : undefined}
              className="flex-1 flex flex-col items-center justify-center min-h-[64px] tap-target"
            >
              <motion.div
                whileTap={{ scale: 0.90 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-full"
                style={{ background: "var(--color-brand)" }}
              >
                <Icon
                  size={20}
                  strokeWidth={2}
                  aria-hidden={true}
                  style={{ color: "var(--color-text-on-brand)" }}
                />
                <span
                  className="text-[10px] font-semibold tracking-wide"
                  style={{ color: "var(--color-text-on-brand)" }}
                >
                  {label}
                </span>
              </motion.div>
            </Link>
          );
        }

        const color = isActive ? "var(--color-brand-dark)" : "var(--color-text-muted)";
        const weight = isActive ? 600 : 400;

        return (
          <Link
            key={href}
            href={href}
            aria-label={ariaLabel}
            aria-current={isActive ? "page" : undefined}
            className="flex-1 flex flex-col items-center justify-center min-h-[64px] tap-target"
          >
            <motion.div
              whileTap={{ scale: 0.90 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5"
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.2 : 1.8}
                aria-hidden={true}
                style={{
                  color,
                  transition: "color 150ms ease",
                }}
              />
              <span
                className="text-[10px] tracking-wide"
                style={{
                  color,
                  fontWeight: weight,
                  transition: "color 150ms ease, font-weight 150ms ease",
                }}
              >
                {label}
              </span>
            </motion.div>
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomNav;
