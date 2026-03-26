'use client';

/**
 * /customer/cards/[cardId] — Card Detail + QR Code
 *
 * Dynamic route: cardId is the on-chain StampCard object ID.
 *
 * Shows the customer's individual loyalty card including:
 * - Merchant name + back navigation
 * - Stamp grid progress
 * - Large QR code for the merchant to scan (encodes cardId + wallet address)
 * - "Show this QR to the merchant" label
 *
 * In Next.js 16 App Router, params is a Promise in client components.
 * Use React's `use()` hook to unwrap it synchronously within the render.
 *
 * If the cardId doesn't match any card in the wallet, shows a 404 state
 * with a back button.
 */

import { use } from 'react';
import Link from 'next/link';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { Store } from 'lucide-react';
import { WalletGuard } from '@/components/wallet-guard';
import { BeautifulQR } from '@/components/beautiful-qr';
import { StampGrid } from '@/components/stamp-grid';
import { useMyCards } from '@/hooks/use-my-cards';
import { encodeCustomerCardQR } from '@/lib/qr-utils';

// ---------------------------------------------------------------------------
// Page entry — unwrap params via React.use()
// ---------------------------------------------------------------------------

interface CardDetailPageProps {
  params: Promise<{ cardId: string }>;
}

export default function CardDetailPage({ params }: CardDetailPageProps) {
  // Next.js 16: params is a Promise — unwrap with React.use()
  const { cardId } = use(params);

  return (
    <WalletGuard
      heading="Ikonekta ang wallet"
      description="Para makita ang iyong loyalty card"
    >
      <CardDetailView cardId={cardId} />
    </WalletGuard>
  );
}

// ---------------------------------------------------------------------------
// CardDetailView — rendered only after wallet is connected
// ---------------------------------------------------------------------------

interface CardDetailViewProps {
  cardId: string;
}

function CardDetailView({ cardId }: CardDetailViewProps) {
  const account = useCurrentAccount();
  const { data: cards, isLoading, error } = useMyCards();

  const card = cards?.find((c) => String(c.objectId) === cardId) ?? null;
  const walletAddress = account?.address ?? '';

  /** QR value: base64-encoded card_scan payload with cardId + wallet. */
  const qrValue = encodeCustomerCardQR(cardId, walletAddress);

  return (
    <div className="mx-auto w-full max-w-md px-5 py-8">
      {/* Back navigation */}
      <div className="mb-6">
        <Link
          href="/customer/cards"
          className={[
            'text-sm text-[--color-text-secondary]',
            'transition-opacity hover:opacity-80',
            'focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-[--color-primary] rounded',
          ].join(' ')}
        >
          ← Back to Cards
        </Link>
      </div>

      {/* Loading state */}
      {isLoading && <CardDetailSkeleton />}

      {/* Fetch error */}
      {!isLoading && error && (
        <ErrorState message={error.message} />
      )}

      {/* Card not found */}
      {!isLoading && !error && !card && (
        <NotFoundState />
      )}

      {/* Card found — render full detail */}
      {!isLoading && !error && card && (
        <div className="flex flex-col gap-6">
          {/* Merchant identity header */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[--color-bg-elevated] overflow-hidden"
              aria-hidden="true"
            >
              {card.merchantLogo ? (
                <img
                  src={card.merchantLogo}
                  alt={card.merchantName}
                  className="h-12 w-12 rounded-xl object-cover"
                />
              ) : (
                <Store size={24} className="text-[--color-text-muted]" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-xl font-bold text-[--color-text-primary] truncate">
                {card.merchantName || 'Unknown Merchant'}
              </h1>
              <p className="text-sm text-[--color-text-muted]">
                Loyalty Card
              </p>
            </div>
          </div>

          {/* Stamp grid */}
          <div className="rounded-2xl border border-[--color-border] bg-[--color-bg-surface] p-5">
            <StampGrid
              totalSlots={card.stampsRequired}
              filledSlots={card.currentStamps}
              size="lg"
            />
          </div>

          {/* Progress text */}
          <p
            className="text-center text-sm font-medium text-[--color-text-secondary]"
            aria-live="polite"
          >
            {card.currentStamps} of {card.stampsRequired} stamps collected
          </p>

          {/* Redeem prompt when card is complete */}
          {card.currentStamps >= card.stampsRequired && (
            <Link
              href={`/customer/cards/${cardId}/reward`}
              className={[
                'w-full inline-flex items-center justify-center rounded-xl px-4 py-3',
                'bg-[--color-accent-loyalty] text-[--color-bg-base] text-sm font-semibold',
                'transition-opacity hover:opacity-90 active:opacity-75',
                'focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-[--color-accent-loyalty] focus-visible:ring-offset-2',
                'focus-visible:ring-offset-[--color-bg-base]',
              ].join(' ')}
            >
              Claim Your Reward
            </Link>
          )}

          {/* QR code section */}
          <div className="rounded-2xl border border-[--color-border] bg-[--color-bg-surface] p-6">
            <p className="text-sm font-medium text-[--color-text-secondary] text-center mb-4">
              Show this QR to the merchant
            </p>

            <div className="flex justify-center rounded-2xl bg-white p-5">
              <BeautifulQR
                value={qrValue}
                size={240}
                foregroundColor="#111111"
                backgroundColor="#ffffff"
              />
            </div>

            <p className="mt-3 text-center text-xs text-[--color-text-muted]">
              Card ID: {cardId.slice(0, 8)}…{cardId.slice(-6)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error / skeleton / not-found states
// ---------------------------------------------------------------------------

function CardDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading card">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-[--color-bg-surface] animate-pulse" />
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-5 w-40 rounded bg-[--color-bg-surface] animate-pulse" />
          <div className="h-3 w-24 rounded bg-[--color-bg-surface] animate-pulse" />
        </div>
      </div>
      <div className="h-32 rounded-2xl bg-[--color-bg-surface] animate-pulse" />
      <div className="h-64 rounded-2xl bg-[--color-bg-surface] animate-pulse" />
    </div>
  );
}

interface ErrorStateProps {
  message: string;
}

function ErrorState({ message }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-[--color-error]/30 bg-[--color-error]/10 p-6 text-center">
      <p className="text-sm text-[--color-error]">{message}</p>
      <Link
        href="/customer/cards"
        className={[
          'rounded-xl px-5 py-2.5 text-sm font-semibold',
          'border border-[--color-border] bg-[--color-bg-surface]',
          'text-[--color-text-primary]',
          'transition-colors hover:bg-[--color-bg-elevated]',
        ].join(' ')}
      >
        Back to Cards
      </Link>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex flex-col items-center gap-5 py-12 text-center">
      <span className="text-5xl" aria-hidden="true">🔍</span>
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-[--color-text-primary]">Card not found</p>
        <p className="text-sm text-[--color-text-secondary]">
          This card doesn&apos;t exist in your wallet or may have been removed.
        </p>
      </div>
      <Link
        href="/customer/cards"
        className={[
          'inline-flex items-center justify-center rounded-xl px-6 py-3',
          'bg-[--color-primary] text-white text-sm font-semibold',
          'transition-opacity hover:opacity-90 active:opacity-75',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-[--color-primary] focus-visible:ring-offset-2',
          'focus-visible:ring-offset-[--color-bg-base]',
        ].join(' ')}
      >
        Back to Cards
      </Link>
    </div>
  );
}
