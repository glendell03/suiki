"use client";

/**
 * /customer/cards/[cardId] -- Card Detail Page (V2 SUI Water Design)
 *
 * Dynamic route: cardId is the on-chain StampCard object ID.
 *
 * Layout: transparent PageHeader over a solid brand hero strip, with content
 * overlapping via negative margin. MerchantAvatar centered at the hero/content
 * boundary. Below that: progress card, reward card, stamp history, and QR code.
 *
 * Next.js 16: params is a Promise -- unwrap with React.use().
 */

import { use } from "react";
import Link from "next/link";
import { ChevronLeft, Trophy } from "lucide-react";
import { useAccount } from "@/hooks/use-account";

import { motion } from "framer-motion";
import { WalletGuard } from "@/components/wallet-guard";
import { PageHeader } from "@/components/page-header";
import { BottomNav } from "@/components/bottom-nav";
import { MerchantAvatar } from "@/components/merchant-avatar";
import { ThemedStampGrid } from "@/components/stamp-slot";
import { ProgressBar } from "@/components/progress-bar";
import { Badge } from "@/components/badge";
import { useMyCards } from "@/hooks/use-my-cards";

// ---------------------------------------------------------------------------
// Page entry -- unwrap params via React.use()
// ---------------------------------------------------------------------------

interface CardDetailPageProps {
  params: Promise<{ cardId: string }>;
}

export default function CardDetailPage({ params }: CardDetailPageProps) {
  const { cardId } = use(params);

  return (
    <WalletGuard
      heading="Connect your wallet"
      description="To view your loyalty card"
    >
      <CardDetailView cardId={cardId} />
    </WalletGuard>
  );
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/** Format an ISO date string (or null) to a human-readable medium date (en-PH). */
function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "Never";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(date);
}

// ---------------------------------------------------------------------------
// Back button for transparent PageHeader over brand hero
// ---------------------------------------------------------------------------

const backButton = (
  <Link
    href="/customer/cards"
    aria-label="Back to cards"
    className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 tap-target"
  >
    <ChevronLeft size={20} style={{ color: "white" }} strokeWidth={2} aria-hidden={true} />
  </Link>
);

// ---------------------------------------------------------------------------
// CardDetailView -- rendered only after wallet is connected
// ---------------------------------------------------------------------------

function CardDetailView({ cardId }: { cardId: string }) {
  const account = useAccount();
  const { data: cards, isLoading, isError, error } = useMyCards();

  const card = cards?.find((c) => c.cardId === cardId) ?? null;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-dvh bg-(--color-bg-base)">
        <PageHeader title="" leftAction={backButton} transparent />
        <div className="h-[120px] bg-(--color-brand) relative pt-safe" />
        <CardDetailSkeleton />
        <BottomNav />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="min-h-dvh bg-(--color-bg-base)">
        <PageHeader title="" leftAction={backButton} transparent />
        <div className="h-[120px] bg-(--color-brand) relative pt-safe" />
        <div className="relative -mt-8 pb-nav px-4 flex flex-col gap-4 mx-auto w-full max-w-[430px]">
          <div className="glass-card p-6 flex flex-col items-center gap-3 text-center mt-4">
            <p className="text-[15px] font-semibold text-(--color-text-primary)">
              Couldn&apos;t load card
            </p>
            <p className="text-[13px] text-(--color-text-secondary)">
              {error?.message ?? "Something went wrong. Please try again."}
            </p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Card not found
  if (!card) {
    return (
      <div className="min-h-dvh bg-(--color-bg-base)">
        <PageHeader title="" leftAction={backButton} transparent />
        <div className="h-[120px] bg-(--color-brand) relative pt-safe" />
        <NotFoundState />
        <BottomNav />
      </div>
    );
  }

  const isRewardReady = card.currentStamps >= card.stampsRequired;
  const progressRatio = card.stampsRequired > 0
    ? card.currentStamps / card.stampsRequired
    : 0;
  const stampsRemaining = Math.max(
    0,
    card.stampsRequired - card.currentStamps,
  );
  return (
    <div className="min-h-dvh bg-(--color-bg-base)">
      {/* Transparent header overlapping the hero */}
      <PageHeader title="" leftAction={backButton} transparent />

      {/* Hero band -- solid brand color */}
      <div className="h-[120px] bg-(--color-brand) relative pt-safe" />

      {/* Content overlapping the hero via negative margin */}
      <div className="relative -mt-8 pb-nav px-4 flex flex-col gap-4 mx-auto w-full max-w-[430px]">
        {/* Merchant identity -- centered, overlapping hero */}
        <div className="flex flex-col items-center gap-2">
          <MerchantAvatar
            logoUrl={card.logoUrl}
            name={card.merchantName || "Merchant"}
            size={64}
          />
          <h1
            className="text-[20px] font-bold text-(--color-text-primary) text-center"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {card.merchantName || "Unknown Merchant"}
          </h1>
          <p className="text-[13px] text-(--color-text-secondary) text-center">
            Loyalty Card
          </p>
          <Badge variant={isRewardReady ? "reward" : "active"}>
            {isRewardReady ? "Reward Ready" : "Active"}
          </Badge>
        </div>

        {/* Your Progress card */}
        <ProgressSection
          currentStamps={card.currentStamps}
          stampsRequired={card.stampsRequired}
          progressRatio={progressRatio}
          stampsRemaining={stampsRemaining}
          isRewardReady={isRewardReady}
          themeId={card.themeId}
        />

        {/* Your Reward card */}
        <RewardSection
          isRewardReady={isRewardReady}
          stampsRequired={card.stampsRequired}
          cardId={cardId}
        />

        {/* Stamp History */}
        <StampHistorySection lastStampedAt={card.lastStampedAt} />

      </div>

      <BottomNav />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress section
// ---------------------------------------------------------------------------

interface ProgressSectionProps {
  currentStamps: number;
  stampsRequired: number;
  progressRatio: number;
  stampsRemaining: number;
  isRewardReady: boolean;
  themeId: number;
}

/** White surface card showing stamp grid, progress bar, and label. */
function ProgressSection({
  currentStamps,
  stampsRequired,
  progressRatio,
  stampsRemaining,
  isRewardReady,
  themeId,
}: ProgressSectionProps) {
  return (
    <div className="glass-card p-5 flex flex-col gap-4">
      <p
        className="text-[15px] font-semibold text-(--color-text-primary)"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {currentStamps} / {stampsRequired} stamps collected
      </p>

      <ThemedStampGrid earned={currentStamps} total={stampsRequired} themeId={themeId} />

      <ProgressBar
        value={progressRatio}
        height={6}
        showMilestone
      />

      <p className="text-[13px] text-(--color-text-secondary)">
        {isRewardReady
          ? "Reward ready!"
          : `${stampsRemaining} more stamp${stampsRemaining !== 1 ? "s" : ""} to earn your reward`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reward section
// ---------------------------------------------------------------------------

interface RewardSectionProps {
  isRewardReady: boolean;
  stampsRequired: number;
  cardId: string;
}

/** Card with loyalty-subtle background showing the reward info and optional CTA. */
function RewardSection({
  isRewardReady,
  stampsRequired,
  cardId,
}: RewardSectionProps) {
  return (
    <div
      className="rounded-(--radius-xl) p-5 flex flex-col gap-3"
      style={{ background: "var(--color-loyalty-subtle)" }}
    >
      <div className="flex items-center gap-3">
        <Trophy
          size={24}
          style={{ color: "var(--color-loyalty-dark)" }}
          aria-hidden="true"
        />
        <p
          className="text-[15px] font-semibold text-(--color-text-primary)"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Complete your card
        </p>
      </div>

      <p className="text-[13px] text-(--color-text-secondary)">
        Collect {stampsRequired} stamps to unlock
      </p>

      {isRewardReady && (
        <Link
          href={`/customer/cards/${cardId}/reward`}
          className={[
            "w-full inline-flex items-center justify-center rounded-full px-4 py-3",
            "text-[15px] font-semibold text-white",
            "transition-opacity hover:opacity-90 active:opacity-75",
            "tap-target",
          ].join(" ")}
          style={{ background: "var(--color-loyalty)" }}
        >
          Redeem Now
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stamp history section
// ---------------------------------------------------------------------------

/** Shows the last stamped date or a "no stamps yet" message. */
function StampHistorySection({ lastStampedAt }: { lastStampedAt: string | null }) {
  return (
    <div className="glass-card p-5">
      <p
        className="text-[15px] font-semibold text-(--color-text-primary) mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Stamp History
      </p>
      <p className="text-[13px] text-(--color-text-secondary)">
        {lastStampedAt
          ? `Last stamped: ${formatDate(lastStampedAt)}`
          : "No stamps yet"}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading state
// ---------------------------------------------------------------------------

/** Pulsing skeleton layout matching the card detail structure. */
function CardDetailSkeleton() {
  const pulse = "bg-(--color-border) animate-pulse";

  return (
    <div className="relative -mt-8 pb-nav px-4 flex flex-col gap-4 mx-auto w-full max-w-[430px]" aria-busy="true">
      {/* Avatar placeholder */}
      <div className="flex flex-col items-center gap-2">
        <div className={`w-16 h-16 rounded-full ${pulse}`} />
        <div className={`h-5 w-40 rounded ${pulse}`} />
        <div className={`h-3 w-28 rounded ${pulse}`} />
        <div className={`h-5 w-16 rounded-full ${pulse}`} />
      </div>

      {/* Progress card placeholder */}
      <div className={`rounded-(--radius-xl) h-48 ${pulse}`} />

      {/* Reward card placeholder */}
      <div className={`rounded-(--radius-xl) h-28 ${pulse}`} />

      {/* History placeholder */}
      <div className={`rounded-(--radius-xl) h-16 ${pulse}`} />

      {/* QR placeholder */}
      <div className={`rounded-(--radius-xl) h-64 ${pulse}`} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 404 state
// ---------------------------------------------------------------------------

/** Shown when the cardId does not match any card in the wallet. */
function NotFoundState() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 px-6 text-center">
      <p className="text-(--color-text-secondary)">Card not found</p>
      <Link
        href="/customer/cards"
        className="text-(--color-brand-dark) font-medium"
      >
        &larr; Back to Cards
      </Link>
    </div>
  );
}
