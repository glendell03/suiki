"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, CreditCard } from "lucide-react";

import { WalletGuard } from "@/components/wallet-guard";
import { PageHeader } from "@/components/page-header";
import { BottomNav } from "@/components/bottom-nav";
import { FilterChips } from "@/components/filter-chips";
import { StampCard } from "@/components/stamp-card";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";
import { useMyCards } from "@/hooks/use-my-cards";
import type { CardWithProgram as StampCardType } from "@/types/db";
import { AlertCircle } from "lucide-react";

/** Filter chip options for the cards list. */
const FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Near Reward", value: "near" },
  { label: "Done", value: "done" },
];

/** Stagger animation for the card list container. */
const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
};

/** Spring entrance animation for each card item. */
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 380, damping: 28 },
  },
};

/**
 * Filter cards by their stamp progress status.
 *
 * - "active": has at least 1 stamp but not yet complete
 * - "near": 80%+ progress but not yet complete
 * - "done": current stamps >= required stamps
 * - "all" (default): no filter applied
 */
function filterCards(cards: StampCardType[], filter: string): StampCardType[] {
  switch (filter) {
    case "active":
      return cards.filter(
        (c) => c.currentStamps > 0 && c.currentStamps < c.stampsRequired,
      );
    case "near":
      return cards.filter(
        (c) =>
          c.stampsRequired > 0 &&
          c.currentStamps / c.stampsRequired >= 0.8 &&
          c.currentStamps < c.stampsRequired,
      );
    case "done":
      return cards.filter((c) => c.currentStamps >= c.stampsRequired);
    default:
      return cards;
  }
}

/** Back button rendered in the PageHeader left slot. */
const backButton = (
  <Link
    href="/customer"
    aria-label="Back to home"
    className="flex items-center justify-center w-10 h-10 tap-target rounded-full"
    style={{ color: "var(--color-text-primary)" }}
  >
    <ChevronLeft size={20} strokeWidth={2} aria-hidden={true} />
  </Link>
);

export default function CardsPage() {
  return (
    <WalletGuard
      heading="Connect your wallet"
      description="To see your loyalty cards"
    >
      <CardsContent />
    </WalletGuard>
  );
}

function CardsContent() {
  const [filter, setFilter] = useState("all");
  const router = useRouter();
  const { data: cards, isLoading, isError, error } = useMyCards();

  /** Sort by progress ratio descending, then filter by selected chip. */
  const filteredCards = useMemo(() => {
    if (!cards) return [];

    const sorted = [...cards].sort((a, b) => {
      const ratioA = a.currentStamps / Math.max(a.stampsRequired, 1);
      const ratioB = b.currentStamps / Math.max(b.stampsRequired, 1);
      return ratioB - ratioA;
    });

    return filterCards(sorted, filter);
  }, [cards, filter]);

  const hasNoCardsAtAll = !isLoading && !isError && (!cards || cards.length === 0);
  const hasNoFilterResults =
    !isLoading && !isError && cards && cards.length > 0 && filteredCards.length === 0;

  return (
    <div className="min-h-dvh bg-(--color-bg-base) pt-14">
      <PageHeader title="My Cards" leftAction={backButton} />

      {/* Filter chips — sticky below the fixed header */}
      <div className="sticky top-14 bg-(--color-bg-base) z-30 border-b border-(--color-border) max-w-[430px] mx-auto w-full">
        <FilterChips
          id="cards-filter"
          options={FILTER_OPTIONS}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {/* Scrollable card list */}
      <div className="mx-auto w-full max-w-[430px] pb-nav px-4 pt-4 flex flex-col gap-3">
        {/* Loading skeletons */}
        {isLoading && (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton variant="card" />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
        )}

        {/* Error state */}
        {isError && (
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load cards"
            description={error?.message ?? "Something went wrong. Please try again."}
            action={{ label: "Retry", onClick: () => window.location.reload() }}
          />
        )}

        {/* Empty state: no cards at all */}
        {hasNoCardsAtAll && (
          <EmptyState
            icon={CreditCard}
            title="No loyalty cards yet"
            description="Scan a QR code at a Suiki merchant to start collecting stamps."
            action={{ label: "Find Merchants", href: "/customer/search" }}
          />
        )}

        {/* Empty state: filter yields no results */}
        {hasNoFilterResults && (
          <EmptyState
            icon={CreditCard}
            title="No cards match"
            description="Try a different filter."
          />
        )}

        {/* Card list with stagger animation */}
        {!isLoading && filteredCards.length > 0 && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-3"
            role="list"
            aria-label="Loyalty cards"
          >
            {filteredCards.map((card) => (
              <motion.div
                key={card.cardId}
                variants={itemVariants}
                role="listitem"
              >
                <StampCard
                  programId={card.programId}
                  merchantName={card.merchantName}
                  programName={`${card.merchantName} Rewards`}
                  logoUrl={card.logoUrl}
                  stampCount={card.currentStamps}
                  totalStamps={card.stampsRequired}
                  rewardDescription={card.rewardDescription}
                  variant="compact"
                  onTap={() =>
                    router.push(`/customer/cards/${card.cardId}`)
                  }
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
