"use client";

import { useState, useRef, useEffect } from "react";
import { UserRound, Copy, LogOut, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useCurrentAccount,
  useDAppKit,
} from "@mysten/dapp-kit-react";

/** Truncate a Sui address to `0xabcd...ef12` form. */
export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}

/**
 * WalletDropdown -- circular glass avatar button with animated dropdown.
 *
 * Shows a UserRound icon. On tap, slides down a panel with:
 *   - Full wallet address (truncated, copy button)
 *   - Disconnect button
 *
 * Closes on outside click or Escape key.
 */
export function WalletDropdown() {
  const account = useCurrentAccount();
  const { disconnectWallet } = useDAppKit();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const address = account?.address ?? "";
  const shortAddress = address ? truncateAddress(address) : null;

  /* Close on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  /* Close on Escape */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  /** Copy the full address to clipboard and flash a check icon. */
  async function handleCopy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  /* Disconnected state -- show empty circle placeholder */
  if (!account) {
    return (
      <div
        className="h-8 w-8 rounded-full bg-[--color-bg-elevated] border border-[--color-border]"
        aria-label="Wallet not connected"
      />
    );
  }

  return (
    <div ref={ref} className="relative">
      {/* Avatar button */}
      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Wallet menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[--color-primary]/30 bg-[--color-primary]/15"
      >
        <UserRound
          size={16}
          className="text-[--color-primary]"
          strokeWidth={2}
        />
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="liquid-surface absolute right-0 top-10 z-50 w-64 rounded-2xl p-3"
            style={{ transformOrigin: "top right" }}
          >
            {/* Address row */}
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[--color-bg-elevated]/60 px-3 py-2.5">
              <span className="font-address truncate text-[--color-text-secondary]">
                {shortAddress}
              </span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleCopy}
                aria-label="Copy wallet address"
                className="flex-shrink-0 text-[--color-text-muted] transition-colors hover:text-[--color-text-primary]"
              >
                {copied ? (
                  <Check size={14} className="text-[--color-primary]" />
                ) : (
                  <Copy size={14} />
                )}
              </motion.button>
            </div>

            {/* Divider */}
            <div className="my-2 h-px bg-[--color-border-subtle]" />

            {/* Disconnect */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                disconnectWallet();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-[--color-error] transition-colors hover:bg-[--color-error]/10"
            >
              <LogOut size={15} strokeWidth={2} />
              Disconnect wallet
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default WalletDropdown;
