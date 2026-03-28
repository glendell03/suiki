'use client';

/**
 * /customer/cards/[cardId]/reward — Congratulations / Reward Claim Screen
 *
 * Shown when a customer has collected enough stamps to redeem a reward.
 *
 * If the card is NOT complete (currentStamps < stampsRequired), this page
 * redirects back to the card detail page to prevent premature reward display.
 *
 * Shows:
 * - "Congratulations!" heading
 * - "You earned a free reward at [Merchant Name]!"
 * - Reward details from card data
 * - Large QR code for the merchant to scan and confirm the claim
 * - "Continue" button back to /customer/cards
 *
 * In Next.js 16 App Router, params is a Promise in client components.
 * Use React's `use()` hook to unwrap it synchronously.
 */

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount } from '@/hooks/use-account';
import { WalletGuard } from '@/components/wallet-guard';
import { useMyCards } from '@/hooks/use-my-cards';
import { encodeRewardClaimQR } from '@/lib/qr-utils';
import { BeautifulQR } from '@/components/beautiful-qr';

// ---------------------------------------------------------------------------
// Page entry — unwrap params via React.use()
// ---------------------------------------------------------------------------

interface RewardPageProps {
  params: Promise<{ cardId: string }>;
}

export default function RewardClaimPage({ params }: RewardPageProps) {
  // Next.js 16: params is a Promise — unwrap with React.use()
  const { cardId } = use(params);

  return (
    <WalletGuard
      heading="Ikonekta ang wallet"
      description="Para ma-claim ang iyong reward"
    >
      <RewardClaimView cardId={cardId} />
    </WalletGuard>
  );
}

// ---------------------------------------------------------------------------
// RewardClaimView — rendered after wallet is connected
// ---------------------------------------------------------------------------

interface RewardClaimViewProps {
  cardId: string;
}

function RewardClaimView({ cardId }: RewardClaimViewProps) {
  const router = useRouter();
  const account = useAccount();
  const { data: cards, isLoading, error } = useMyCards();

  const card = cards?.find((c) => c.cardId === cardId) ?? null;
  const walletAddress = account?.address ?? '';

  const isCardComplete = card !== null && card.currentStamps >= card.stampsRequired;

  /** Redirect to card detail if card exists but is not complete. */
  useEffect(() => {
    if (!isLoading && !error && card && !isCardComplete) {
      router.replace(`/customer/cards/${cardId}`);
    }
  }, [isLoading, error, card, isCardComplete, cardId, router]);

  /**
   * QR value: base64-encoded reward_claim payload.
   * The programId is used as the rewardId since it is the canonical
   * identifier for what reward belongs to which program.
   */
  const qrValue = card
    ? encodeRewardClaimQR(cardId, walletAddress, String(card.programId))
    : '';

  return (
    <div className="mx-auto w-full max-w-md px-5 py-8">
      {/* Loading */}
      {isLoading && <RewardSkeleton />}

      {/* Fetch error */}
      {!isLoading && error && (
        <ErrorState message={error.message} />
      )}

      {/* Card not found */}
      {!isLoading && !error && !card && (
        <NotFoundState />
      )}

      {/* Card found but not complete — redirect in progress */}
      {!isLoading && !error && card && !isCardComplete && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div
            className="h-10 w-10 rounded-full border-2 border-(--color-primary) border-t-transparent animate-spin"
            aria-label="Redirecting…"
            role="status"
          />
          <p className="text-sm text-(--color-text-secondary)">Redirecting…</p>
        </div>
      )}

      {/* Congratulations screen — card complete */}
      {!isLoading && !error && card && isCardComplete && (
        <CongratulationsScreen
          merchantName={card.merchantName}
          stampsRequired={card.stampsRequired}
          totalEarned={card.totalEarned}
          qrValue={qrValue}
          walletAddress={walletAddress}
          cardId={cardId}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CongratulationsScreen
// ---------------------------------------------------------------------------

interface CongratulationsScreenProps {
  merchantName: string;
  stampsRequired: number;
  totalEarned: number;
  qrValue: string;
  walletAddress: string;
  cardId: string;
}

/**
 * CongratulationsScreen — celebration view displayed when a card is complete.
 *
 * The merchant scans the displayed QR to confirm the reward on-chain.
 */
function CongratulationsScreen({
  merchantName,
  stampsRequired,
  totalEarned,
  qrValue,
  walletAddress,
  cardId,
}: CongratulationsScreenProps) {
  const displayAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : '';

  return (
    <div className="flex flex-col gap-6">
      {/* Celebration header */}
      <div className="text-center flex flex-col items-center gap-3">
        <span className="text-6xl" aria-hidden="true">🎉</span>

        <h1 className="text-3xl font-bold text-(--color-success)">
          Congratulations!
        </h1>

        <p className="text-lg font-semibold text-(--color-text-primary) leading-snug">
          You earned a free reward at {merchantName || 'the merchant'}!
        </p>
      </div>

      {/* Reward details card */}
      <div className="rounded-2xl border border-(--color-border) bg-(--color-bg-surface) p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-wide">
          Your Reward
        </h2>

        <p className="text-base font-medium text-(--color-text-primary)">
          {`Free reward after ${stampsRequired} stamps collected`}
        </p>

        {totalEarned > 1 && (
          <p className="text-xs text-(--color-text-muted)">
            This is your {totalEarned}{ordinalSuffix(totalEarned)} reward from {merchantName}
          </p>
        )}
      </div>

      {/* QR code for merchant to scan */}
      <div className="rounded-2xl border border-(--color-border) bg-(--color-bg-surface) p-6">
        <p className="text-sm font-medium text-(--color-text-secondary) text-center mb-4">
          Ask the merchant to scan this QR to confirm your reward
        </p>

        <div className="flex justify-center">
          <BeautifulQR
            value={qrValue}
            size={300}
            foregroundColor="#111111"
            backgroundColor="transparent"
          />
        </div>

        <p className="mt-3 text-center text-xs text-(--color-text-muted)">
          Reward claim QR for card {cardId.slice(0, 8)}…{cardId.slice(-6)}
        </p>
      </div>

      {/* Continue button */}
      <Link
        href="/customer/cards"
        className={[
          'w-full inline-flex items-center justify-center rounded-xl px-4 py-3',
          'bg-(--color-primary) text-white text-sm font-semibold',
          'transition-opacity hover:opacity-90 active:opacity-75',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-(--color-primary) focus-visible:ring-offset-2',
          'focus-visible:ring-offset-(--color-bg-base)',
        ].join(' ')}
      >
        Continue
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ordinal suffix helper
// ---------------------------------------------------------------------------

/**
 * Returns the ordinal suffix for a number (1st, 2nd, 3rd, etc.).
 * Used to display "2nd reward", "3rd reward", etc.
 */
function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0] ?? 'th';
}

// ---------------------------------------------------------------------------
// Error / skeleton / not-found states
// ---------------------------------------------------------------------------

function RewardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading reward">
      <div className="flex flex-col items-center gap-3">
        <div className="h-16 w-16 rounded-full bg-(--color-bg-surface) animate-pulse" />
        <div className="h-8 w-48 rounded bg-(--color-bg-surface) animate-pulse" />
        <div className="h-5 w-64 rounded bg-(--color-bg-surface) animate-pulse" />
      </div>
      <div className="h-24 rounded-2xl bg-(--color-bg-surface) animate-pulse" />
      <div className="h-80 rounded-2xl bg-(--color-bg-surface) animate-pulse" />
    </div>
  );
}

interface ErrorStateProps {
  message: string;
}

function ErrorState({ message }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-(--color-error)/30 bg-(--color-error)/10 p-6 text-center">
      <p className="text-sm text-(--color-error)">{message}</p>
      <Link
        href="/customer/cards"
        className={[
          'rounded-xl px-5 py-2.5 text-sm font-semibold',
          'border border-(--color-border) bg-(--color-bg-surface)',
          'text-(--color-text-primary)',
          'transition-colors hover:bg-(--color-bg-elevated)',
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
        <p className="font-semibold text-(--color-text-primary)">Card not found</p>
        <p className="text-sm text-(--color-text-secondary)">
          This loyalty card doesn&apos;t exist in your wallet.
        </p>
      </div>
      <Link
        href="/customer/cards"
        className={[
          'inline-flex items-center justify-center rounded-xl px-6 py-3',
          'bg-(--color-primary) text-white text-sm font-semibold',
          'transition-opacity hover:opacity-90 active:opacity-75',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-(--color-primary) focus-visible:ring-offset-2',
          'focus-visible:ring-offset-(--color-bg-base)',
        ].join(' ')}
      >
        Back to Cards
      </Link>
    </div>
  );
}
