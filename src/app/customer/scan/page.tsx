"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { WalletGuard } from "@/components/wallet-guard";
import { BottomNav } from "@/components/bottom-nav";
import { BeautifulQR } from "@/components/beautiful-qr";
import { encodeCustomerCardQR } from "@/lib/qr-utils";

export default function ScanPage() {
  return (
    <WalletGuard
      heading="Connect wallet"
      description="To display your QR code"
    >
      <ScanContent />
    </WalletGuard>
  );
}

function ScanContent() {
  const account = useCurrentAccount();
  const qrValue = account
    ? encodeCustomerCardQR("default", account.address)
    : "";

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{
        // Intentionally darker than --color-gradient-start/end — scan page has
        // a distinct "cave entrance" feel to signal focus mode. Not a reusable token.
        background: "linear-gradient(160deg, #0a3d20 0%, #0a2a18 50%, #061a10 100%)",
      }}
    >
      {/* Back navigation */}
      <div className="px-5 pt-safe pt-4">
        <Link href="/customer">
          <motion.div
            whileTap={{ scale: 0.93 }}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <ChevronLeft size={20} className="text-white" strokeWidth={2} />
          </motion.div>
        </Link>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 pb-nav">
        {/* Heading */}
        <div className="text-center">
          <h1
            className="text-2xl font-bold text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Show QR Code
          </h1>
          <p className="mt-1.5 text-sm text-white/60">
            Please show this to the cashier
          </p>
        </div>

        {/* White floating QR card */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.1 }}
          className="flex flex-col items-center gap-3 rounded-3xl bg-white p-6"
          style={{
            boxShadow: "0 20px 60px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.2)",
          }}
        >
          {qrValue ? (
            <Suspense
              fallback={
                <div className="h-64 w-64 animate-pulse rounded-2xl bg-gray-100" />
              }
            >
              <BeautifulQR
                value={qrValue}
                size={256}
                foregroundColor="#111111"
                backgroundColor="#ffffff"
              />
            </Suspense>
          ) : (
            <div className="flex h-64 w-64 items-center justify-center rounded-2xl bg-gray-100">
              <p className="text-sm text-gray-400">Connect wallet first</p>
            </div>
          )}
        </motion.div>

        {/* Wallet address */}
        {account && (
          <p className="max-w-xs text-center font-mono text-xs text-white/40">
            {account.address.slice(0, 12)}…{account.address.slice(-8)}
          </p>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
