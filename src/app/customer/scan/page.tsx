'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { WalletGuard } from '@/components/wallet-guard';
import QrScanner from '@/components/qr-scanner';
import QrCode from '@/components/qr-code';
import { StampProgress } from '@/components/stamp-progress';
import { getProgramById, findCardForProgram } from '@/lib/queries';
import type { MerchantQRPayload, StampProgram, StampCard, CustomerQRPayload } from '@/types/sui';
import { asSuiObjectId, asSuiAddress } from '@/types/sui';

/**
 * Customer QR scan page.
 *
 * Flow:
 *   1. Customer scans the merchant's QR code with their camera.
 *   2. App fetches the program details and any existing card in parallel.
 *   3. Shows program info + customer's own QR for the merchant to scan back.
 *   4. "Scan Another" resets all state back to the scanner view.
 */
export default function CustomerScanPage() {
  return (
    <WalletGuard>
      <ScanView />
    </WalletGuard>
  );
}

// ---------------------------------------------------------------------------
// Inner view — rendered only after wallet is connected
// ---------------------------------------------------------------------------

type ScanPhase =
  | { kind: 'scanning' }
  | { kind: 'loading' }
  | { kind: 'ready'; program: StampProgram; existingCard: StampCard | null }
  | { kind: 'error'; message: string };

function ScanView() {
  const account = useCurrentAccount();
  const [phase, setPhase] = useState<ScanPhase>({ kind: 'scanning' });

  /** Parse and validate a scanned QR payload, then fetch program data. */
  const handleScan = async (raw: string) => {
    if (!account) return;

    // Only handle one scan — ignore subsequent frames while loading.
    if (phase.kind !== 'scanning') return;

    // Safely parse the JSON payload.
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      setPhase({ kind: 'error', message: 'Invalid QR code. Please scan a Suiki merchant QR.' });
      return;
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      (payload as Record<string, unknown>)['type'] !== 'merchant'
    ) {
      setPhase({ kind: 'error', message: 'This QR code is not a Suiki merchant code.' });
      return;
    }

    const merchantPayload = payload as MerchantQRPayload;

    if (!merchantPayload.programId || !merchantPayload.merchantAddress) {
      setPhase({ kind: 'error', message: 'Merchant QR code is missing required data.' });
      return;
    }

    setPhase({ kind: 'loading' });

    try {
      const [program, existingCard] = await Promise.all([
        getProgramById(merchantPayload.programId),
        findCardForProgram(account.address, merchantPayload.programId),
      ]);

      if (!program) {
        setPhase({ kind: 'error', message: 'Stamp program not found on-chain.' });
        return;
      }

      setPhase({ kind: 'ready', program, existingCard });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load program data.';
      setPhase({ kind: 'error', message });
    }
  };

  const reset = () => setPhase({ kind: 'scanning' });

  return (
    <div className="mx-auto w-full max-w-md px-5 py-8">
      {/* Back navigation */}
      <div className="mb-6">
        <Link
          href="/customer"
          className={[
            'text-sm text-[--color-text-secondary]',
            'transition-opacity hover:opacity-80',
            'focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-[--color-primary] rounded',
          ].join(' ')}
        >
          ← Back to My Stamps
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-[--color-text-primary] mb-6">
        Scan Merchant QR
      </h1>

      {phase.kind === 'scanning' && (
        <QrScanner onScan={handleScan} />
      )}

      {phase.kind === 'loading' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div
            className="h-10 w-10 rounded-full border-2 border-[--color-primary] border-t-transparent animate-spin"
            aria-label="Loading program data"
            role="status"
          />
          <p className="text-sm text-[--color-text-secondary]">
            Loading stamp program…
          </p>
        </div>
      )}

      {phase.kind === 'error' && (
        <ErrorCard message={phase.message} onRetry={reset} />
      )}

      {phase.kind === 'ready' && account && (
        <ProgramCard
          program={phase.program}
          existingCard={phase.existingCard}
          customerAddress={account.address}
          onReset={reset}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ProgramCardProps {
  program: StampProgram;
  existingCard: StampCard | null;
  customerAddress: string;
  onReset: () => void;
}

/**
 * ProgramCard — shown after a successful merchant QR scan.
 *
 * Displays program details, the customer's current progress (if any),
 * instructions for getting stamped, and the customer's own QR code for
 * the merchant to scan.
 */
function ProgramCard({
  program,
  existingCard,
  customerAddress,
  onReset,
}: ProgramCardProps) {
  /** Build the customer QR payload to show to the merchant. */
  const customerQrData: CustomerQRPayload = {
    type: 'customer',
    customerAddress: asSuiAddress(customerAddress),
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Program info */}
      <div className="rounded-2xl border border-[--color-border] bg-[--color-bg-surface] p-5">
        <div className="flex items-center gap-3 mb-4">
          {program.logoUrl ? (
            <img
              src={program.logoUrl}
              alt={program.name}
              width={48}
              height={48}
              className="h-12 w-12 flex-shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[--color-bg-elevated] text-2xl"
              aria-hidden="true"
            >
              🏪
            </span>
          )}

          <div className="flex flex-col min-w-0">
            <h2 className="font-semibold text-[--color-text-primary] truncate">
              {program.name}
            </h2>
            <p className="text-xs text-[--color-text-muted]">
              {program.rewardDescription}
            </p>
          </div>
        </div>

        {/* Current progress or intro text */}
        {existingCard ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[--color-text-secondary]">
              Your current progress:
            </p>
            <StampProgress
              current={existingCard.currentStamps}
              required={existingCard.stampsRequired}
            />
          </div>
        ) : (
          <p className="text-sm text-[--color-text-secondary]">
            Collect {program.stampsRequired} stamps to earn: {program.rewardDescription}
          </p>
        )}
      </div>

      {/* Instruction */}
      <div className="rounded-xl border border-[--color-border] bg-[--color-bg-elevated] px-4 py-3">
        <p className="text-sm text-[--color-text-secondary] text-center">
          Ask the merchant to scan your QR code to receive a stamp
        </p>
      </div>

      {/* Customer QR */}
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-[--color-border] bg-[--color-bg-surface] p-6">
        <p className="text-sm font-medium text-[--color-text-secondary] mb-2">
          Your stamp QR
        </p>
        <QrCode
          data={JSON.stringify(customerQrData)}
          size={220}
          label={`${customerAddress.slice(0, 6)}…${customerAddress.slice(-4)}`}
        />
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={onReset}
        className={[
          'w-full rounded-xl px-4 py-3 text-sm font-semibold',
          'border border-[--color-border] bg-transparent',
          'text-[--color-text-secondary]',
          'transition-colors hover:bg-[--color-bg-elevated]',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-[--color-primary] focus-visible:ring-offset-2',
          'focus-visible:ring-offset-[--color-bg-base]',
        ].join(' ')}
      >
        Scan Another
      </button>
    </div>
  );
}

interface ErrorCardProps {
  message: string;
  onRetry: () => void;
}

function ErrorCard({ message, onRetry }: ErrorCardProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-[--color-error]/30 bg-[--color-error]/10 p-6 text-center">
      <p className="text-sm text-[--color-error]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={[
          'rounded-xl px-5 py-2.5 text-sm font-semibold',
          'border border-[--color-border] bg-[--color-bg-surface]',
          'text-[--color-text-primary]',
          'transition-colors hover:bg-[--color-bg-elevated]',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-[--color-primary]',
        ].join(' ')}
      >
        Try Again
      </button>
    </div>
  );
}
