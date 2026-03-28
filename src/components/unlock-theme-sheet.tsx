"use client";

/**
 * UnlockThemeSheet -- bottom sheet for purchasing a premium stamp theme.
 *
 * Handles two cases:
 *  1. Merchant has an existing MerchantProfile -> buildPurchaseTheme
 *  2. Merchant has no profile yet -> buildCreateProfileAndPurchaseTheme
 *
 * Uses useSignAndExecuteTransaction (NOT gas-sponsored) since this is a coin transfer.
 */

import { useState } from "react";
import { X, Lock, Loader2, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDAppKit, useCurrentAccount, useCurrentClient } from "@mysten/dapp-kit-react";
import { useQueryClient } from "@tanstack/react-query";
import { getTheme, PREMIUM_THEME_PRICE_SUI } from "@/lib/stamp-themes";
import { StampSlot } from "@/components/stamp-slot";

interface UnlockThemeSheetProps {
  themeId: number | null;
  profileId: string | null;
  onClose: () => void;
  /** Called after a successful purchase so parent can refresh and select the theme. */
  onPurchased: (themeId: number) => void;
}

type PurchaseState = "idle" | "confirming" | "success" | "error";

export function UnlockThemeSheet({
  themeId,
  profileId,
  onClose,
  onPurchased,
}: UnlockThemeSheetProps) {
  const isOpen = themeId !== null;
  const theme = themeId !== null ? getTheme(themeId) : null;

  const queryClient = useQueryClient();
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const client = useCurrentClient();

  const [state, setState] = useState<PurchaseState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handlePurchase() {
    if (themeId === null || !account) return;
    setState("confirming");
    setErrorMsg(null);

    try {
      // Dynamically import to avoid circular deps at module level
      const { buildPurchaseTheme, buildCreateProfileAndPurchaseTheme } = await import(
        "@/lib/transactions"
      );

      const tx = profileId
        ? buildPurchaseTheme(account.address, profileId, themeId)
        : buildCreateProfileAndPurchaseTheme(account.address, themeId);

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });

      if (result.FailedTransaction) {
        throw new Error(
          result.FailedTransaction.status.error?.message ?? "Transaction failed on-chain",
        );
      }

      // Wait for the transaction to be indexed before invalidating so the refetch
      // sees the updated unlocked_themes bitmask on the MerchantProfile object.
      await client.waitForTransaction({ digest: result.Transaction.digest });

      // Invalidate profile cache so useMerchantProfile refetches
      await queryClient.invalidateQueries({ queryKey: ["merchantProfile"] });

      setState("success");
      setTimeout(() => {
        onPurchased(themeId);
        onClose();
        setState("idle");
      }, 1200);
    } catch (e) {
      setState("error");
      setErrorMsg(e instanceof Error ? e.message : "Transaction failed. Please try again.");
    }
  }

  return (
    <AnimatePresence>
      {isOpen && theme && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[430px]"
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-2xl) var(--radius-2xl) 0 0",
              paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-(--color-border)" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="tap-target absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-full bg-(--color-bg-base)"
            >
              <X size={16} className="text-(--color-text-secondary)" />
            </button>

            <div className="px-6 pt-2 pb-4 flex flex-col gap-5">
              {/* Theme preview */}
              <div className="flex items-center gap-4">
                <div
                  className="flex items-center justify-center rounded-2xl"
                  style={{
                    width: 72,
                    height: 72,
                    background: theme.bgColor,
                    flexShrink: 0,
                  }}
                >
                  <StampSlot earned themeId={themeId} size={52} />
                </div>
                <div>
                  <p
                    className="text-[18px] font-bold text-(--color-text-primary)"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {theme.name}
                  </p>
                  <p className="text-[13px] text-(--color-text-secondary) mt-0.5">
                    {theme.vibe}
                  </p>
                </div>
              </div>

              {/* Description */}
              <p className="text-[14px] text-(--color-text-secondary)">
                {theme.description}
              </p>

              {/* Price */}
              <div
                className="flex items-center justify-between rounded-(--radius-xl) px-4 py-3"
                style={{ background: "var(--color-bg-base)" }}
              >
                <div className="flex items-center gap-2">
                  <Lock size={14} className="text-(--color-text-muted)" />
                  <span className="text-[14px] text-(--color-text-secondary)">
                    One-time unlock
                  </span>
                </div>
                <span
                  className="text-[16px] font-bold"
                  style={{ color: "var(--color-loyalty-dark)" }}
                >
                  {PREMIUM_THEME_PRICE_SUI} SUI
                </span>
              </div>

              {!profileId && (
                <p className="text-[12px] text-(--color-text-muted) text-center -mt-2">
                  A loyalty profile will be created in the same transaction.
                </p>
              )}

              {/* Error */}
              {state === "error" && errorMsg && (
                <div
                  className="rounded-(--radius-xl) border px-4 py-3 text-[13px]"
                  style={{ borderColor: "var(--color-error)", color: "var(--color-error)", background: "#fef2f2" }}
                  role="alert"
                >
                  {errorMsg}
                </div>
              )}

              {/* CTA */}
              <button
                type="button"
                onClick={() => void handlePurchase()}
                disabled={state === "confirming" || state === "success"}
                className="tap-target w-full flex items-center justify-center gap-2 text-white font-semibold rounded-full disabled:opacity-60 transition-opacity"
                style={{
                  background: state === "success" ? "var(--color-success)" : "var(--color-loyalty)",
                  padding: "14px 0",
                  fontSize: 16,
                  fontFamily: "var(--font-display)",
                }}
              >
                {state === "confirming" && <Loader2 size={18} className="animate-spin" />}
                {state === "success" && <CheckCircle size={18} />}
                {state === "confirming" ? "Confirming..." : state === "success" ? "Unlocked!" : "Buy & Unlock"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
