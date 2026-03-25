'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { useQueryClient } from '@tanstack/react-query';
import { WalletGuard } from '@/components/wallet-guard';
import { StampCardDisplay } from '@/components/stamp-card-display';
import { useMyCards } from '@/hooks/use-my-cards';
import { useSponsoredTx } from '@/hooks/use-sponsored-tx';
import { buildRedeem } from '@/lib/transactions';
import type { StampCard } from '@/types/sui';

/**
 * Customer dashboard — shows all stamp cards owned by the connected wallet.
 *
 * Loading state: 3 skeleton placeholder cards.
 * Empty state: prompt to scan a merchant QR code.
 * Populated: grid of StampCardDisplay with inline redeem handling.
 */
export default function CustomerPage() {
  return (
    <WalletGuard
      heading="Ikonekta ang wallet"
      description="Para makita ang inyong mga stamps"
    >
      <CustomerDashboard />
    </WalletGuard>
  );
}

// ---------------------------------------------------------------------------
// Dashboard — rendered only after wallet is connected
// ---------------------------------------------------------------------------

function CustomerDashboard() {
  const account = useCurrentAccount();
  const queryClient = useQueryClient();
  const { data: cards, isLoading, error } = useMyCards();
  const { executeSponsoredTx, isPending: isRedeemPending, error: redeemError } =
    useSponsoredTx();

  /** objectId of the card currently being redeemed, null when idle. */
  const [redeemingCardId, setRedeemingCardId] = useState<string | null>(null);

  /** Handle the redeem flow for a specific card. */
  const handleRedeem = async (card: StampCard) => {
    if (!account) return;

    setRedeemingCardId(card.objectId);
    try {
      await executeSponsoredTx(
        buildRedeem(account.address, card.programId, card.objectId),
      );
      // Invalidate the cards cache so the updated stamp count is fetched.
      await queryClient.invalidateQueries({ queryKey: ['cards', account.address] });
    } finally {
      setRedeemingCardId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-5 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[--color-text-primary]">
          My Stamps
        </h1>
        <Link
          href="/customer/scan"
          className={[
            'text-sm font-medium text-[--color-primary]',
            'transition-opacity hover:opacity-80',
            'focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-[--color-primary] rounded',
          ].join(' ')}
        >
          + Scan QR
        </Link>
      </div>

      {/* Redeem error banner */}
      {redeemError && (
        <div className="mb-4 rounded-xl border border-[--color-error]/30 bg-[--color-error]/10 px-4 py-3">
          <p className="text-sm text-[--color-error]">
            {redeemError.message}
          </p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && <CardSkeletonList />}

      {/* Fetch error */}
      {!isLoading && error && (
        <p className="text-center text-sm text-[--color-error]">
          {error.message}
        </p>
      )}

      {/* Empty state */}
      {!isLoading && !error && cards?.length === 0 && (
        <EmptyState />
      )}

      {/* Card grid */}
      {!isLoading && !error && cards && cards.length > 0 && (
        <ul className="flex flex-col gap-4">
          {cards.map((card) => (
            <li key={card.objectId}>
              <StampCardDisplay
                card={card}
                onRedeem={() => handleRedeem(card)}
                isRedeeming={
                  isRedeemPending && redeemingCardId === card.objectId
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-5 py-16 text-center">
      <span className="text-5xl" aria-hidden="true">
        🏪
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-[--color-text-primary]">
          Wala pang stamps
        </p>
        <p className="text-sm text-[--color-text-secondary]">
          Visit a merchant and scan their QR code to start collecting.
        </p>
      </div>
      <Link
        href="/customer/scan"
        className={[
          'inline-flex items-center justify-center rounded-xl px-6 py-3',
          'bg-[--color-primary] text-white text-sm font-semibold',
          'transition-opacity hover:opacity-90 active:opacity-75',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-[--color-primary] focus-visible:ring-offset-2',
          'focus-visible:ring-offset-[--color-bg-base]',
        ].join(' ')}
      >
        Scan a merchant QR
      </Link>
    </div>
  );
}

/** Placeholder skeleton cards shown during initial data fetch. */
function CardSkeletonList() {
  return (
    <ul className="flex flex-col gap-4" aria-busy="true" aria-label="Loading stamp cards">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-40 rounded-2xl border border-[--color-border] bg-[--color-bg-surface] animate-pulse"
          aria-hidden="true"
        />
      ))}
    </ul>
  );
}
