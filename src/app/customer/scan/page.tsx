"use client";

/**
 * /customer/scan — QR Code Display (V2 SUI Water Design)
 *
 * Focused action screen where customers show their wallet QR code
 * for merchants to scan. Uses a solid brand-blue hero section with
 * a floating white QR card that overlaps the boundary.
 *
 * BottomNav is intentionally hidden — this is a focused action screen.
 */

import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useAccount } from "@/hooks/use-account";
import { WalletGuard } from "@/components/wallet-guard";
import { WalletChip } from "@/components/wallet-chip";
import { BeautifulQR } from "@/components/beautiful-qr";
import { encodeCustomerCardQR } from "@/lib/qr-utils";

export default function ScanPage() {
  return (
    <WalletGuard heading="Connect wallet" description="To display your QR code">
      <ScanContent />
    </WalletGuard>
  );
}

/** Inner content rendered after wallet is connected. */
function ScanContent() {
  const account = useAccount();
  const qrValue = account ? encodeCustomerCardQR("default", account.address) : "";

  return (
    <div className="min-h-dvh flex flex-col bg-(--color-bg-base)">
      {/* Brand-blue hero section */}
      <div className="relative flex flex-col items-center justify-center h-44 bg-(--color-brand) px-6" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        {/* Back button */}
        <Link
          href="/customer"
          aria-label="Back to home"
          className="absolute top-4 left-4 tap-target flex items-center justify-center w-10 h-10 rounded-full bg-white/20"
          style={{ top: "max(16px, env(safe-area-inset-top))" }}
        >
          <ChevronLeft size={20} aria-hidden={true} style={{ color: "white" }} strokeWidth={2} />
        </Link>

        {/* Decorative watermark */}
        <span
          aria-hidden="true"
          className="absolute select-none pointer-events-none"
          style={{
            fontSize: 120,
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            color: "rgba(255, 255, 255, 0.10)",
          }}
        >
          水
        </span>

        {/* Title */}
        <h1
          className="text-2xl text-white"
          style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
        >
          Show QR Code
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "rgba(255, 255, 255, 0.75)" }}>
          Hold up to the merchant scanner
        </p>
      </div>

      {/* White lower section */}
      <div className="flex-1 flex flex-col items-center px-6 pb-8 mx-auto w-full max-w-[430px]">
        {/* Floating QR card — overlaps hero boundary */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="mt-6 flex flex-col items-center bg-(--color-surface) p-6"
          style={{
            borderRadius: "var(--radius-2xl)",
            boxShadow: "var(--shadow-float)",
          }}
        >
          {qrValue ? (
            <Suspense
              fallback={
                <div className="h-64 w-64 animate-pulse rounded-2xl bg-(--color-border)" />
              }
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.12 }}
              >
                <BeautifulQR
                  value={qrValue}
                  size={256}
                  label="Your wallet QR code"
                  foregroundColor="#111111"
                  backgroundColor="#ffffff"
                />
              </motion.div>
            </Suspense>
          ) : (
            <div className="flex h-64 w-64 items-center justify-center rounded-2xl bg-(--color-border)">
              <p className="text-sm text-(--color-text-muted)">Connect wallet first</p>
            </div>
          )}
        </motion.div>

        {/* Wallet address chip */}
        {account && (
          <WalletChip address={account.address} className="mt-4" />
        )}

        {/* Helper text */}
        <p className="mt-3 text-[13px] text-(--color-text-muted) text-center">
          The merchant will scan this to add a stamp to your card
        </p>
      </div>
    </div>
  );
}
