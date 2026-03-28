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
import { ChevronLeft } from "lucide-react";
import { useAccount } from "@/hooks/use-account";

import { WalletGuard } from "@/components/wallet-guard";
import { PageHeader } from "@/components/page-header";
import { BottomNav } from "@/components/bottom-nav";
import { MerchantAvatar } from "@/components/merchant-avatar";
import { StampCard } from "@/components/stamp-card";
import { Badge } from "@/components/badge";
import { useMyCards } from "@/hooks/use-my-cards";
import { useStampEvents } from "@/hooks/use-stamp-events";
import { getTheme } from "@/lib/stamp-themes";
import { encodeCustomerCardQR } from "@/lib/qr-utils";

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

  // Real-time stamp animation — no-op when card is null (still loading/missing)
  const { pendingAnimation } = useStampEvents(
    card?.cardId,
    card?.currentStamps ?? 0,
    account?.address,
  );

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
  const theme = getTheme(card.themeId);

  return (
    <div className="min-h-dvh bg-(--color-bg-base)">
      {/* Transparent header overlapping the hero */}
      <PageHeader title="" leftAction={backButton} transparent />

      {/* Hero band — themed fill color */}
      <div className="h-[120px] relative pt-safe" style={{ background: theme.fillColor }} />

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

        {/* Stamp card — Apple Wallet style with QR + last stamp in footer */}
        <StampCard
          themeId={card.themeId}
          merchantName={card.merchantName || "Unknown Merchant"}
          rewardDescription={card.rewardDescription || "Loyalty reward"}
          stampCount={card.currentStamps}
          totalStamps={card.stampsRequired}
          logoUrl={card.logoUrl}
          animateNewStamp={pendingAnimation}
          lastStampedAt={card.lastStampedAt}
          {...(account
            ? { qrValue: encodeCustomerCardQR(account.address) }
            : {})}
        />
      </div>

      <BottomNav />
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
