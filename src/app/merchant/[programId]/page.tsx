'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { WalletGuard } from '@/components/wallet-guard';
import { Button } from '@/components/ui/button';
import { useSponsoredTx } from '@/hooks/use-sponsored-tx';
import { getProgramById, findCardForProgram } from '@/lib/queries';
import {
  buildCreateCardAndStamp,
  buildIssueStamp,
} from '@/lib/transactions';
import type { StampCard, CustomerQRPayload } from '@/types/sui';
import { asSuiAddress } from '@/types/sui';
import {
  getDailyTxCount,
  incrementDailyTxCount,
  isAtDailyLimit,
  isNearDailyLimit,
  DAILY_LIMIT,
  NEAR_LIMIT_THRESHOLD,
} from '@/lib/rate-limit';
import QrCode from '@/components/qr-code';
import QrScanner from '@/components/qr-scanner';

// SUI address: 0x followed by exactly 64 hex characters
const SUI_ADDRESS_RE = /^0x[0-9a-fA-F]{64}$/;

// ---------------------------------------------------------------------------
// Types used for the scan/confirm flow
// ---------------------------------------------------------------------------

interface ConfirmData {
  customerAddress: string;
  /** Null while the card lookup is in flight, or when no card exists. */
  card: StampCard | null;
  /** True while findCardForProgram is still loading. */
  cardLoading: boolean;
}

// ---------------------------------------------------------------------------
// Sub-component: Program header info
// ---------------------------------------------------------------------------

interface ProgramHeaderProps {
  name: string;
  logoUrl: string;
  stampsRequired: number;
  rewardDescription: string;
  totalIssued: number;
}

/** Displays the key attributes of a StampProgram. */
function ProgramHeader({
  name,
  logoUrl,
  stampsRequired,
  rewardDescription,
  totalIssued,
}: ProgramHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[--color-border] bg-[--color-bg-surface] p-5">
      <div className="flex items-center gap-4">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${name} logo`}
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[--color-bg-elevated] text-3xl"
            aria-hidden="true"
          >
            🏪
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold text-[--color-text-primary]">
            {name}
          </h2>
          <p className="mt-0.5 text-sm text-[--color-text-secondary]">
            {totalIssued} stamp{totalIssued !== 1 ? 's' : ''} issued total
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[--color-bg-elevated] px-4 py-3">
          <p className="text-xs text-[--color-text-muted]">Stamps for reward</p>
          <p className="mt-0.5 text-xl font-bold text-[--color-accent-loyalty]">
            {stampsRequired}
          </p>
        </div>
        <div className="rounded-xl bg-[--color-bg-elevated] px-4 py-3">
          <p className="text-xs text-[--color-text-muted]">Reward</p>
          <p className="mt-0.5 text-sm font-medium text-[--color-text-primary] line-clamp-2">
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

  const isAtLimit = count >= DAILY_LIMIT;

  return (
    <div
      className={[
        'rounded-lg px-4 py-3 text-sm',
        isAtLimit
          ? 'border border-[--color-error] bg-[--color-bg-surface] text-[--color-error]'
          : 'border border-[--color-warning] bg-[--color-bg-surface] text-[--color-warning]',
      ].join(' ')}
      role="alert"
    >
      {isAtLimit
        ? 'Daily limit reached — stamps paused until tomorrow.'
        : `Warning: ${count}/${DAILY_LIMIT} daily stamps used`}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: QR Merchant display (the merchant's own QR code)
// ---------------------------------------------------------------------------

interface MerchantQrSectionProps {
  programId: string;
  merchantAddress: string;
}

/** Renders the merchant's QR code that customers scan to get stamped. */
function MerchantQrSection({ programId, merchantAddress }: MerchantQrSectionProps) {
  const payload = JSON.stringify({
    type: 'merchant',
    programId,
    merchantAddress,
  });

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-[--color-border] bg-[--color-bg-surface] p-5">
      <p className="text-sm font-medium text-[--color-text-secondary]">
        Show this QR to customers to collect stamps
      </p>
      <div className="rounded-xl bg-white p-3">
        <QrCode data={payload} size={180} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Scan confirmation UI
// ---------------------------------------------------------------------------

interface StampConfirmProps {
  confirmData: ConfirmData;
  isPending: boolean;
  txError: Error | null;
  successMessage: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Truncates an address to the first 8 characters (after 0x). */
function truncateAddress(address: string): string {
  return address.length > 10 ? `${address.slice(0, 10)}…` : address;
}

/**
 * Confirmation panel shown after a customer QR is scanned.
 * Displays stamp count context and confirm/cancel actions.
 */
function StampConfirm({
  confirmData,
  isPending,
  txError,
  successMessage,
  onConfirm,
  onCancel,
}: StampConfirmProps) {
  const { customerAddress, card, cardLoading } = confirmData;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[--color-border] bg-[--color-bg-surface] p-5">
      <h3 className="font-semibold text-[--color-text-primary]">Confirm Stamp</h3>

      <p className="text-sm text-[--color-text-secondary]">
        Issue stamp to{' '}
        <span className="font-mono font-medium text-[--color-text-primary]">
          {truncateAddress(customerAddress)}
        </span>
        ?
      </p>

      {/* Card status */}
      {cardLoading ? (
        <div className="h-5 w-2/3 animate-pulse rounded bg-[--color-bg-elevated]" />
      ) : card ? (
        <p className="text-sm text-[--color-text-secondary]">
          Current:{' '}
          <span className="font-semibold text-[--color-accent-loyalty]">
            {card.currentStamps}/{card.stampsRequired} stamps
          </span>
        </p>
      ) : (
        <p className="text-sm text-[--color-text-secondary]">
          New customer — will create stamp card
        </p>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="rounded-lg bg-[--color-success] bg-opacity-10 px-4 py-2 text-sm font-medium text-[--color-success]" role="status">
          {successMessage}
        </div>
      )}

      {/* Transaction error */}
      {txError && (
        <div className="rounded-lg border border-[--color-error] px-4 py-2 text-sm text-[--color-error]" role="alert">
          {txError.message}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          variant="secondary"
          onClick={onCancel}
          disabled={isPending}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onConfirm}
          disabled={isPending || cardLoading}
          className="flex-1"
        >
          {isPending ? (
            <>
              <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Issuing…
            </>
          ) : (
            'Issue Stamp'
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page content — rendered inside WalletGuard
// ---------------------------------------------------------------------------

interface ProgramDetailContentProps {
  programId: string;
}

/**
 * Inner component rendered once the wallet is connected.
 * Manages program data fetch, QR display, QR scanning, and stamp issuance.
 */
function ProgramDetailContent({ programId }: ProgramDetailContentProps) {
  const account = useCurrentAccount();
  const { executeSponsoredTx, isPending, error: txError, digest } = useSponsoredTx();

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
      setSuccessMessage(`✓ Stamp issued! (${next}/${card.stampsRequired} stamps)`);
    } else {
      setSuccessMessage('✓ Stamp issued! New card created.');
    }

    // Auto-dismiss the success banner after 3 s then reset confirm state.
    const timer = window.setTimeout(() => {
      setSuccessMessage(null);
      setConfirmData(null);
    }, 3000);

    return () => window.clearTimeout(timer);
    // We only want to run when digest changes — a new digest means a new confirmed tx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digest]);

  // Fetch program details.
  const {
    data: program,
    isLoading: programLoading,
    isError: programError,
  } = useQuery({
    queryKey: ['program', programId],
    queryFn: () => getProgramById(programId),
    enabled: !!programId,
  });

  // ---------------------------------------------------------------------------
  // QR scan handler
  // ---------------------------------------------------------------------------

  /** Called by QrScanner when a QR code is successfully decoded. */
  const handleScan = async (raw: string) => {
    setScanMode(false);
    setScanError(null);

    // Safely parse — reject malformed or non-customer payloads.
    let payload: CustomerQRPayload;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        (parsed as Record<string, unknown>)['type'] !== 'customer' ||
        typeof (parsed as Record<string, unknown>)['customerAddress'] !== 'string'
      ) {
        setScanError('Not a valid customer QR code. Ask the customer to show their Suiki QR.');
        return;
      }
      payload = parsed as CustomerQRPayload;
    } catch {
      setScanError('Could not read QR code. Please try again.');
      return;
    }

    const customerAddress = payload.customerAddress;

    // Validate the address format before sending it on-chain.
    if (!SUI_ADDRESS_RE.test(customerAddress)) {
      setScanError('Invalid wallet address in QR code.');
      return;
    }

    // Show confirm panel immediately while card lookup runs in background.
    setConfirmData({ customerAddress, card: null, cardLoading: true });

    const card = await findCardForProgram(customerAddress, programId);
    // Update confirm data with the resolved card (may be null for new customers).
    setConfirmData({ customerAddress, card, cardLoading: false });
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
  // Render
  // ---------------------------------------------------------------------------

  if (programLoading) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <div className="flex flex-col gap-4">
          <div className="h-40 animate-pulse rounded-2xl bg-[--color-bg-surface]" />
          <div className="h-48 animate-pulse rounded-2xl bg-[--color-bg-surface]" />
        </div>
      </div>
    );
  }

  if (programError || !program) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-8 text-center">
        <p className="text-[--color-error]">Program not found.</p>
        <Link href="/merchant" className="mt-4 inline-block">
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const isAtLimit = dailyCount >= DAILY_LIMIT;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8">
      {/* Back navigation */}
      <Link
        href="/merchant"
        className="inline-flex items-center gap-1 text-sm text-[--color-text-secondary] hover:text-[--color-text-primary]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
        </svg>
        Back to Dashboard
      </Link>

      {/* Program header */}
      <ProgramHeader
        name={program.name}
        logoUrl={program.logoUrl}
        stampsRequired={program.stampsRequired}
        rewardDescription={program.rewardDescription}
        totalIssued={program.totalIssued}
      />

      {/* Daily rate-limit status */}
      <RateLimitBar count={dailyCount} />

      {/* Merchant QR code — always visible so merchant can show it to customers */}
      {account?.address && (
        <MerchantQrSection
          programId={programId}
          merchantAddress={account.address}
        />
      )}

      {/* Scan error feedback */}
      {scanError && !scanMode && !confirmData && (
        <div
          className="rounded-lg border border-[--color-error] bg-[--color-bg-surface] px-4 py-3 text-sm text-[--color-error]"
          role="alert"
        >
          {scanError}
        </div>
      )}

      {/* Scan customer QR section */}
      {!confirmData && !scanMode && (
        <Button
          variant="primary"
          onClick={() => { setScanMode(true); setScanError(null); }}
          disabled={isAtLimit}
          className="w-full"
        >
          Scan Customer QR
        </Button>
      )}

      {/* Inline QR scanner — not a modal, renders in flow */}
      {scanMode && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[--color-border] bg-[--color-bg-surface] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[--color-text-secondary]">
              Point camera at customer QR
            </p>
            <button
              type="button"
              onClick={() => setScanMode(false)}
              className="text-xs text-[--color-text-muted] hover:text-[--color-text-primary]"
              aria-label="Close scanner"
            >
              Cancel
            </button>
          </div>
          <QrScanner
            onScan={(raw: string) => void handleScan(raw)}
            onError={() => setScanMode(false)}
          />
        </div>
      )}

      {/* Stamp issuance confirmation panel */}
      {confirmData && !scanMode && (
        <StampConfirm
          confirmData={confirmData}
          isPending={isPending}
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
  );
}

// ---------------------------------------------------------------------------
// Page export — params is a Promise in Next.js App Router
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
 * Unwraps the async `params` Promise with React's `use()` hook — this is the
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
