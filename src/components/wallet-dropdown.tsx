"use client";

import { useState, useRef, useEffect } from "react";
import { UserRound, Copy, LogOut, Check, Wallet } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  useCurrentAccount,
  useCurrentClient,
  useDAppKit,
} from "@mysten/dapp-kit-react";

/** Truncate a Sui address to `0xabcd...ef12` form. */
export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}

/** Format MIST to SUI with up to 4 decimal places, trimming trailing zeros. */
function formatSui(mist: string): string {
  const sui = Number(mist) / 1_000_000_000;
  return sui.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

interface WalletDropdownProps {
  /**
   * "light" — white avatar for placement on brand-blue backgrounds.
   * "default" — brand-colored avatar for placement on white/light backgrounds.
   */
  variant?: "default" | "light";
}

/**
 * WalletDropdown — circular avatar button that opens a wallet panel.
 *
 * Panel shows:
 *   - SUI balance
 *   - Truncated address with copy button
 *   - Disconnect button
 *
 * Closes on outside click or Escape key.
 */
export function WalletDropdown({ variant = "default" }: WalletDropdownProps) {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const { disconnectWallet } = useDAppKit();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const address = account?.address ?? "";
  const shortAddress = address ? truncateAddress(address) : null;

  const { data: balanceData } = useQuery({
    queryKey: ["sui-balance", address],
    queryFn: () =>
      client.getBalance({ owner: address, coinType: "0x2::sui::SUI" }),
    enabled: !!address && open,
    staleTime: 30_000,
  });

  const suiBalance = balanceData ? formatSui(balanceData.balance.balance) : "—";

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

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable
    }
  }

  if (!account) return null;

  const isLight = variant === "light";

  return (
    <div ref={ref} className="relative">
      {/* Avatar button */}
      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Wallet menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="tap-target flex items-center justify-center rounded-full"
        style={{
          width: 36,
          height: 36,
          background: isLight ? "rgba(255,255,255,0.20)" : "var(--color-brand-subtle)",
          border: isLight ? "1.5px solid rgba(255,255,255,0.35)" : "1.5px solid var(--color-brand)",
        }}
      >
        <UserRound
          size={18}
          strokeWidth={2}
          style={{ color: isLight ? "white" : "var(--color-brand)" }}
        />
      </motion.button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            role="menu"
            className="absolute right-0 top-11 z-50 w-64 flex flex-col gap-1"
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-xl)",
              boxShadow: "var(--shadow-float)",
              border: "1px solid var(--color-border)",
              transformOrigin: "top right",
              padding: "10px",
            }}
          >
            {/* Balance row */}
            <div
              className="flex items-center gap-3 px-3 py-3"
              style={{
                background: "var(--color-brand-subtle)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              <Wallet size={16} style={{ color: "var(--color-brand)", flexShrink: 0 }} />
              <div className="flex flex-col min-w-0">
                <span
                  className="text-(--color-text-muted)"
                  style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}
                >
                  Balance
                </span>
                <span
                  className="text-(--color-text-primary) tabular-nums"
                  style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}
                >
                  {suiBalance} SUI
                </span>
              </div>
            </div>

            {/* Address row */}
            <button
              onClick={handleCopy}
              aria-label="Copy wallet address"
              className="flex items-center justify-between gap-2 px-3 py-2.5 w-full text-left transition-colors"
              style={{ borderRadius: "var(--radius-lg)" }}
            >
              <span
                className="truncate text-(--color-text-secondary)"
                style={{ fontSize: 13, fontFamily: "var(--font-mono-stack)" }}
              >
                {shortAddress}
              </span>
              <span className="shrink-0 text-(--color-text-muted)">
                {copied ? (
                  <Check size={14} style={{ color: "var(--color-brand)" }} />
                ) : (
                  <Copy size={14} />
                )}
              </span>
            </button>

            {/* Divider */}
            <div className="h-px mx-1" style={{ background: "var(--color-border)" }} />

            {/* Disconnect */}
            <button
              onClick={() => { disconnectWallet(); setOpen(false); }}
              role="menuitem"
              className="flex items-center gap-2.5 px-3 py-2.5 w-full text-left transition-colors"
              style={{ borderRadius: "var(--radius-lg)", color: "var(--color-error, #dc2626)", fontSize: 14 }}
            >
              <LogOut size={15} strokeWidth={2} />
              <span style={{ fontWeight: 500 }}>Disconnect wallet</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default WalletDropdown;
