"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ScanLine, AlertTriangle } from "lucide-react";
import { useAccount } from "@/hooks/use-account";
import { WalletGuard } from "@/components/wallet-guard";
import { PageHeader } from "@/components/page-header";
import { MerchantAvatar } from "@/components/merchant-avatar";
import { useSponsoredTx } from "@/hooks/use-sponsored-tx";
import { useProgram } from "@/hooks/use-program";
import {
  buildCreateCardAndStamp,
  buildIssueStamp,
} from "@/lib/transactions";
import type { StampCard } from "@/types/sui";
import { asSuiAddress } from "@/types/sui";
import {
  getDailyTxCount,
  incrementDailyTxCount,
  isAtDailyLimit,
  isNearDailyLimit,
  DAILY_LIMIT,
  NEAR_LIMIT_THRESHOLD,
} from "@/lib/rate-limit";
import QrScanner from "@/components/qr-scanner";
import { decodeQRPayload } from "@/lib/qr-utils";

// SUI address: 0x followed by exactly 64 hex characters
const SUI_ADDRESS_RE = /^0x[0-9a-fA-F]{64}$/;

// ---------------------------------------------------------------------------
// Shared back button for all states (loading, error, main)
// ---------------------------------------------------------------------------

const backButton = (
  <Link
    href="/merchant"
    aria-label="Back"
    className="flex items-center justify-center w-10 h-10 rounded-full tap-target"
  >
    <ChevronLeft
      size={20}
      className="text-(--color-text-primary)"
      strokeWidth={2}
    />
  </Link>
);

// ---------------------------------------------------------------------------
// Types used for the scan/confirm flow
// ---------------------------------------------------------------------------

interface ConfirmData {
  customerAddress: string;
  /** Null while the card lookup is in flight, or when no card exists. */
  card: StampCard | null;
  /** True while the DB card lookup is in flight. */
  cardLoading: boolean;
}

// ---------------------------------------------------------------------------
// Sub-component: Program info card
// ---------------------------------------------------------------------------

interface ProgramInfoCardProps {
  name: string;
  logoUrl: string;
  stampsRequired: number;
  rewardDescription: string;
}

/** Displays the key attributes of a StampProgram inside a card. */
function ProgramInfoCard({
  name,
  logoUrl,
  stampsRequired,
  rewardDescription,
}: ProgramInfoCardProps) {
  return (
    <div
      className="flex flex-col gap-4 p-5"
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-2xl)",
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <MerchantAvatar logoUrl={logoUrl} name={name} size={48} />
        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-[17px] font-bold text-(--color-text-primary)"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {name}
          </h2>
          <p className="mt-0.5 text-[13px] text-(--color-text-muted)">
            {stampsRequired} stamp{stampsRequired !== 1 ? "s" : ""} required
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-(--color-border)" />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {/* Stamps required */}
        <div
          className="flex flex-col gap-1 rounded-(--radius-xl) p-4"
          style={{ background: "var(--color-loyalty-subtle)" }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-loyalty-dark)", letterSpacing: "0.06em" }}
          >
            Stamps needed
          </p>
          <p
            className="text-[28px] font-bold leading-none"
            style={{ fontFamily: "var(--font-display)", color: "var(--color-loyalty)" }}
          >
            {stampsRequired}
          </p>
        </div>

        {/* Reward */}
        <div
          className="flex flex-col gap-1 rounded-(--radius-xl) p-4"
          style={{ background: "var(--color-brand-subtle)" }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-brand-dark)", letterSpacing: "0.06em" }}
          >
            Reward
          </p>
          <p
            className="text-[13px] font-semibold line-clamp-3 leading-snug"
            style={{ color: "var(--color-brand-dark)" }}
          >
            {rewardDescription}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Rate-limit status bar
// ---------------------------------------------------------------------------

interface RateLimitBarProps {
  count: number;
}

/**
 * Shows a warning when approaching the daily stamp limit.
 * Hidden when count is safely below the warning threshold.
 */
function RateLimitBar({ count }: RateLimitBarProps) {
  if (count < NEAR_LIMIT_THRESHOLD) return null;

  const atLimit = count >= DAILY_LIMIT;

  return (
    <div
      className="flex items-center gap-3 rounded-(--radius-xl) px-4 py-3"
      style={{
        background: atLimit ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
        border: `1px solid ${atLimit ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}`,
      }}
      role="alert"
    >
      <AlertTriangle
        size={16}
        style={{ color: atLimit ? "var(--color-error)" : "var(--color-warning)", flexShrink: 0 }}
      />
      <p
        className="text-[13px] font-medium"
        style={{ color: atLimit ? "var(--color-error)" : "#92400e" }}
      >
        {atLimit
          ? "Daily limit reached — stamps paused until tomorrow."
          : `${count}/${DAILY_LIMIT} daily stamps used`}
      </p>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Sub-component: Scan confirmation UI
// ---------------------------------------------------------------------------

interface StampConfirmProps {
  confirmData: ConfirmData;
  isPending: boolean;
  phase: import("@/hooks/use-sponsored-tx").TxPhase;
  txError: Error | null;
  successMessage: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Truncates an address to the first 10 characters. */
function truncateAddress(address: string): string {
  return address.length > 10 ? `${address.slice(0, 10)}...` : address;
}

/**
 * Confirmation panel shown after a customer QR is scanned.
 * Displays stamp count context and confirm/cancel actions.
 */
function StampConfirm({
  confirmData,
  phase,
  isPending,
  txError,
  successMessage,
  onConfirm,
  onCancel,
}: StampConfirmProps) {
  const { customerAddress, card, cardLoading } = confirmData;

  /** Maps tx phase to button label text. */
  function issuingLabel(): string {
    switch (phase) {
      case "building":
        return "Preparing...";
      case "signing":
        return "Approve in wallet...";
      case "confirming":
        return "Confirming...";
      default:
        return "Issuing...";
    }
  }

  return (
    <div className="glass-card p-5">
      <h3
        className="text-[15px] font-semibold text-(--color-text-primary)"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Confirm Stamp
      </h3>

      <p className="mt-3 text-[13px] text-(--color-text-secondary)">
        Issue stamp to{" "}
        <span className="font-mono font-medium text-(--color-text-primary)">
          {truncateAddress(customerAddress)}
        </span>
        ?
      </p>

      {/* Card status */}
      <div className="mt-3">
        {cardLoading ? (
          <div className="h-5 w-2/3 animate-pulse rounded bg-(--color-bg-elevated)" />
        ) : card ? (
          <p className="text-[13px] text-(--color-text-secondary)">
            Current:{" "}
            <span
              className="font-semibold"
              style={{ color: "var(--color-loyalty)" }}
            >
              {card.currentStamps}/{card.stampsRequired} stamps
            </span>
          </p>
        ) : (
          <p className="text-[13px] text-(--color-text-secondary)">
            New customer -- will create stamp card
          </p>
        )}
      </div>

      {/* Success message */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            key="stamp-success"
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -4 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="mt-3 rounded-(--radius-lg) px-4 py-2 text-[13px] font-medium text-center"
            style={{ background: "var(--color-loyalty-subtle)", color: "var(--color-loyalty-dark)" }}
            role="status"
          >
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction error */}
      <AnimatePresence>
        {txError && (
          <motion.div
            key="stamp-error"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-3 rounded-(--radius-lg) border border-red-200 bg-red-50 px-4 py-2 text-[13px] text-red-600"
            role="alert"
          >
            {txError.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="flex-1 inline-flex items-center justify-center rounded-full px-4 py-3 text-[15px] font-semibold text-(--color-text-primary) border border-(--color-border) bg-(--color-surface) transition-opacity hover:opacity-80 active:opacity-60 tap-target disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending || cardLoading}
          className="flex-1 inline-flex items-center justify-center rounded-full px-4 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75 tap-target disabled:opacity-40"
          style={{ background: "var(--color-brand)" }}
        >
          {isPending ? (
            <>
              <svg
                className="h-4 w-4 animate-spin mr-2"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              {issuingLabel()}
            </>
          ) : (
            "Issue Stamp"
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page content -- rendered inside WalletGuard
// ---------------------------------------------------------------------------

interface ProgramDetailContentProps {
  programId: string;
}

/**
 * Inner component rendered once the wallet is connected.
 * Manages program data fetch, QR display, QR scanning, and stamp issuance.
 */
function ProgramDetailContent({ programId }: ProgramDetailContentProps) {
  const account = useAccount();
  const {
    executeSponsoredTx,
    isPending,
    phase,
    error: txError,
    digest,
  } = useSponsoredTx();

  // Prevents concurrent handleScan executions when the scanner fires multiple frames.
  const isHandlingScanRef = useRef(false);

  // UI state
  const [scanMode, setScanMode] = useState(false);
  const [confirmData, setConfirmData] = useState<ConfirmData | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [dailyCount, setDailyCount] = useState(0);

  // Read today's rate-limit count once on mount (client-only).
  useEffect(() => {
    if (account?.address) {
      setDailyCount(getDailyTxCount(account.address));
    }
  }, [account?.address]);

  // After a successful tx: update local rate-limit counter and show success.
  useEffect(() => {
    if (!digest || !confirmData || !account?.address) return;

    incrementDailyTxCount(account.address);
    const newCount = getDailyTxCount(account.address);
    setDailyCount(newCount);

    // Build success message showing updated stamp count when possible.
    const card = confirmData.card;
    if (card) {
      const next = card.currentStamps + 1;
      setSuccessMessage(
        `Stamp issued! (${next}/${card.stampsRequired} stamps)`,
      );
    } else {
      setSuccessMessage("Stamp issued! New card created.");
    }

    // Auto-dismiss the success banner after 3 s then reset confirm state.
    const timer = window.setTimeout(() => {
      setSuccessMessage(null);
      setConfirmData(null);
    }, 3000);

    return () => window.clearTimeout(timer);
    // We only want to run when digest changes -- a new digest means a new confirmed tx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digest]);

  // Fetch program details.
  const {
    data: program,
    isLoading: programLoading,
    isError: programError,
  } = useProgram(programId);

  // ---------------------------------------------------------------------------
  // QR scan handler
  // ---------------------------------------------------------------------------

  /** Called by QrScanner when a QR code is successfully decoded. */
  const handleScan = async (raw: string) => {
    // Prevent concurrent executions -- the scanner emits one event per decoded
    // frame, so multiple fires can arrive before the first await resolves.
    if (isHandlingScanRef.current) return;
    isHandlingScanRef.current = true;

    setScanMode(false);
    setScanError(null);

    try {
      // Decode the compact v1 QR payload produced by encodeCustomerCardQR.
      const decoded = decodeQRPayload(raw);
      if (decoded.type !== "card_scan" || !decoded.walletAddress) {
        setScanError(
          "Not a valid customer QR code. Ask the customer to show their Suiki QR.",
        );
        return;
      }

      const customerAddress = decoded.walletAddress;

      // Validate the address format before sending it on-chain.
      if (!SUI_ADDRESS_RE.test(customerAddress)) {
        setScanError("Invalid wallet address in QR code.");
        return;
      }

      // Show confirm panel immediately while card lookup runs in background.
      setConfirmData({ customerAddress, card: null, cardLoading: true });

      const res = await fetch(
        `/api/cards/lookup?customer=${encodeURIComponent(customerAddress)}&program=${encodeURIComponent(programId)}`,
      );

      if (!res.ok) {
        throw new Error(`Card lookup failed (${res.status})`);
      }

      const { card } = await res.json() as { card: StampCard | null };
      setConfirmData({ customerAddress, card, cardLoading: false });
    } catch (err) {
      // Collapse the confirm panel so the error banner (which only renders when
      // confirmData is null) becomes visible to the merchant.
      setConfirmData(null);
      setScanError(err instanceof Error ? err.message : 'Card lookup failed');
    } finally {
      isHandlingScanRef.current = false;
    }
  };

  // ---------------------------------------------------------------------------
  // Stamp issuance handler
  // ---------------------------------------------------------------------------

  const handleIssueStamp = async () => {
    if (!confirmData || !account?.address) return;

    const { customerAddress, card } = confirmData;
    const merchantAddress = account.address;

    // Guard against daily limit before executing the transaction.
    if (isAtDailyLimit(merchantAddress)) return;

    const tx = card
      ? buildIssueStamp(merchantAddress, programId, card.objectId)
      : buildCreateCardAndStamp(merchantAddress, programId, customerAddress);

    await executeSponsoredTx(tx);
  };

  // ---------------------------------------------------------------------------
  // Render: Loading state
  // ---------------------------------------------------------------------------

  if (programLoading) {
    return (
      <div className="min-h-dvh bg-(--color-bg-base)">
        <PageHeader title="" leftAction={backButton} />
        <div className="mx-auto w-full max-w-[430px] pt-14 px-4 pb-10 flex flex-col gap-4">
          <div className="rounded-(--radius-xl) h-40 bg-(--color-border) animate-pulse" />
          <div className="rounded-(--radius-xl) h-60 bg-(--color-border) animate-pulse" />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Error state
  // ---------------------------------------------------------------------------

  if (programError || !program) {
    return (
      <div className="min-h-dvh bg-(--color-bg-base)">
        <PageHeader title="" leftAction={backButton} />
        <div className="flex flex-col items-center gap-4 py-20 px-6 text-center">
          <p className="text-(--color-text-secondary)">Program not found</p>
          <Link
            href="/merchant"
            className="text-(--color-brand-dark) font-medium"
          >
            &larr; Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Main content
  // ---------------------------------------------------------------------------

  const isAtLimit = dailyCount >= DAILY_LIMIT;

  return (
    <div className="min-h-dvh bg-(--color-bg-base)">
      <PageHeader title={program.name} leftAction={backButton} />

      <div className="mx-auto w-full max-w-[430px] pt-[72px] px-4 pb-10 flex flex-col gap-4">
        {/* Program info card */}
        <ProgramInfoCard
          name={program.name}
          logoUrl={program.logoUrl}
          stampsRequired={program.stampsRequired}
          rewardDescription={program.rewardDescription}
        />

        {/* Daily rate-limit status */}
        <RateLimitBar count={dailyCount} />

        {/* Scan error feedback */}
        {scanError && !scanMode && !confirmData && (
          <div
            className="rounded-(--radius-lg) border border-(--color-error)/30 bg-(--color-error)/10 px-4 py-3 text-[13px] text-(--color-error)"
            role="alert"
          >
            {scanError}
          </div>
        )}

        {/* Scan customer QR button */}
        {!confirmData && !scanMode && (
          <button
            type="button"
            onClick={() => {
              setScanMode(true);
              setScanError(null);
            }}
            disabled={isAtLimit}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75 tap-target disabled:opacity-40"
            style={{ background: "var(--color-brand)" }}
          >
            <ScanLine size={18} aria-hidden={true} />
            Scan Customer QR
          </button>
        )}

        {/* Inline QR scanner — always mounted so the WASM worker stays warm.
            display:none hides it without unmounting; active prop drives start/stop. */}
        <div style={{ display: scanMode ? 'block' : 'none' }}>
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-medium text-(--color-text-secondary)">
                Point camera at customer QR
              </p>
              <button
                type="button"
                onClick={() => setScanMode(false)}
                className="text-[12px] text-(--color-text-muted) hover:text-(--color-text-primary)"
                aria-label="Close scanner"
              >
                Cancel
              </button>
            </div>
            <QrScanner
              active={scanMode}
              onScan={(raw: string) => void handleScan(raw)}
            />
          </div>
        </div>

        {/* Stamp issuance confirmation panel */}
        {confirmData && !scanMode && (
          <StampConfirm
            confirmData={confirmData}
            isPending={isPending}
            phase={phase}
            txError={txError}
            successMessage={successMessage}
            onConfirm={() => void handleIssueStamp()}
            onCancel={() => {
              setConfirmData(null);
              setSuccessMessage(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export -- params is a Promise in Next.js App Router
// ---------------------------------------------------------------------------

interface PageProps {
  /** Next.js 16 App Router: dynamic route params are always a Promise. */
  params: Promise<{ programId: string }>;
}

/**
 * Merchant program detail page.
 *
 * Displays the program info, merchant QR code, and the inline stamp-issuance
 * flow including QR scanning and sponsored transaction submission.
 *
 * Unwraps the async `params` Promise with React's `use()` hook -- this is the
 * correct pattern for client components with dynamic segments in Next.js 16.
 */
export default function ProgramDetailPage({ params }: PageProps) {
  const { programId } = use(params);

  return (
    <WalletGuard heading="Program Detail">
      <ProgramDetailContent programId={programId} />
    </WalletGuard>
  );
}
