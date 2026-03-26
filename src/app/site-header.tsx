"use client";

import Link from "next/link";
import { Bell, Leaf } from "lucide-react";
import { motion } from "framer-motion";
import { WalletDropdown } from "@/components/wallet-dropdown";

/**
 * Slim app header -- logo left, notification bell + wallet dropdown right.
 * Used by individual pages that need a header (customer, merchant).
 * No longer rendered globally in layout.tsx.
 */
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between px-5 py-4">
      {/* Logo */}
      <Link
        href="/"
        aria-label="Suiki home"
        className="flex items-center gap-1.5 text-[--color-primary] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary] rounded"
      >
        <Leaf size={22} strokeWidth={2} />
        <span className="text-base font-bold text-[--color-text-primary]">
          Suiki
        </span>
      </Link>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          aria-label="Notifications"
          className="flex items-center justify-center rounded-full text-[--color-text-secondary] transition-colors hover:text-[--color-text-primary]"
        >
          <Bell size={20} />
        </motion.button>

        <WalletDropdown />
      </div>
    </header>
  );
}
