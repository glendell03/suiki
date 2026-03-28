"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/hooks/use-account";
import { ScanLine, CreditCard, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { WalletGuard } from "@/components/wallet-guard";
import { BottomNav } from "@/components/bottom-nav";
import { PageHeader } from "@/components/page-header";
import { WalletDropdown } from "@/components/wallet-dropdown";
import { StampCard } from "@/components/stamp-card";
import { FilterChips } from "@/components/filter-chips";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";
import { useMyCards } from "@/hooks/use-my-cards";
import type { CardWithProgram } from "@/types/db";

export default function CustomerPage() {
  return (
    <WalletGuard
      heading="Connect your wallet"
      description="To see your stamp cards"
    >
      <CustomerDashboard />
    </WalletGuard>
  );
}

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

function filterCards(cards: CardWithProgram[], filter: string): CardWithProgram[] {
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

/** Suiki brand logo mark shown in the PageHeader left slot. */
function SuikiBrand() {
  return (
    <div className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 20,
          color: "var(--color-brand)",
          lineHeight: 1,
        }}
      >
        水
      </span>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 17,
          color: "var(--color-text-primary)",
        }}
      >
        Suiki
      </span>
    </div>
  );
}

function CustomerDashboard() {
  const [filter, setFilter] = useState("all");
  const router = useRouter();
  const account = useAccount();
  const { data: cards, isLoading, isError, error } = useMyCards();

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
    <div className="bg-(--color-bg-base) min-h-dvh pt-14">
      <PageHeader
        title=""
        leftAction={<SuikiBrand />}
        rightAction={account ? <WalletDropdown /> : null}
      />

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
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading stamp cards">
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
            icon={ScanLine}
            title="No loyalty cards yet"
            description="Scan a QR code at a Suiki merchant to start collecting stamps."
            action={{ label: "Scan QR Code", href: "/customer/scan" }}
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
                  themeId={card.themeId}
                  merchantName={card.merchantName}
                  rewardDescription={card.rewardDescription}
                  stampCount={card.currentStamps}
                  totalStamps={card.stampsRequired}
                  logoUrl={card.logoUrl}
                  onTap={() => router.push(`/customer/cards/${card.cardId}`)}
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
