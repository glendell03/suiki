"use client";

import { useRouter } from "next/navigation";
import { useAccount } from "@/hooks/use-account";
import { ScanLine, CreditCard, Compass } from "lucide-react";
import { motion } from "framer-motion";
import { WalletGuard } from "@/components/wallet-guard";
import { BottomNav } from "@/components/bottom-nav";
import { PageHeader } from "@/components/page-header";
import { WalletDropdown } from "@/components/wallet-dropdown";
import { StampCard } from "@/components/stamp-card";
import { QuickAction } from "@/components/quick-action";
import { SectionHeader } from "@/components/section-header";
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

/** Framer Motion variants for staggered card list entrance. */
const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

/** Individual card entrance spring animation. */
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 400, damping: 30 },
  },
};

/**
 * Sort cards by stamp progress (descending), with most-recently-stamped
 * as tiebreaker. Returns the featured card and remaining cards separately.
 */
function splitFeaturedCard(cards: CardWithProgram[]) {
  const sorted = [...cards].sort((a, b) => {
    const pA = a.currentStamps / Math.max(a.stampsRequired, 1);
    const pB = b.currentStamps / Math.max(b.stampsRequired, 1);
    if (pB !== pA) return pB - pA;
    return (
      new Date(b.lastStampedAt ?? 0).getTime() -
      new Date(a.lastStampedAt ?? 0).getTime()
    );
  });

  return {
    featured: sorted[0] ?? null,
    others: sorted.slice(1),
  };
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

/** Customer home dashboard — cards, quick actions, and more programs. */
function CustomerDashboard() {
  const router = useRouter();
  const account = useAccount();
  const { data: cards, isLoading, error } = useMyCards();

  const hasCards = !isLoading && !error && cards && cards.length > 0;
  const isEmpty = !isLoading && !error && cards?.length === 0;
  const { featured, others } = hasCards
    ? splitFeaturedCard(cards)
    : { featured: null, others: [] };

  return (
    <div className="bg-(--color-bg-base) min-h-dvh">
      <PageHeader
        title=""
        leftAction={<SuikiBrand />}
        rightAction={account ? <WalletDropdown /> : null}
      />

      <div className="mx-auto w-full max-w-[430px] pt-14 pb-nav px-4 flex flex-col gap-6 py-5">
        {/* Your Cards section */}
        <section>
          <SectionHeader
            title="Your Cards"
            action={{ label: "See all \u2192", href: "/customer/cards" }}
          />

          {/* Loading state */}
          {isLoading && (
            <div
              className="flex flex-col gap-3"
              aria-busy="true"
              aria-label="Loading stamp cards"
            >
              <Skeleton variant="card" />
              <Skeleton variant="card" />
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <p className="text-center text-sm text-(--color-text-secondary)">
              {error.message}
            </p>
          )}

          {/* Empty state */}
          {isEmpty && (
            <EmptyState
              icon={ScanLine}
              title="No loyalty cards yet"
              description="Scan a QR code at a Suiki merchant to start collecting stamps."
              action={{ label: "Scan QR Code", href: "/customer/scan" }}
            />
          )}

          {/* Featured card */}
          {featured && (
            <StampCard
              programId={featured.programId}
              merchantName={featured.merchantName}
              programName="Loyalty Program"
              logoUrl={featured.logoUrl}
              stampCount={featured.currentStamps}
              totalStamps={featured.stampsRequired}
              rewardDescription={featured.rewardDescription}
              variant="featured"
              onTap={() =>
                router.push(`/customer/cards/${featured.cardId}`)
              }
            />
          )}
        </section>

        {/* Quick Actions section */}
        <section>
          <SectionHeader title="Quick Actions" />
          <div className="flex gap-3 overflow-x-auto scrollbar-none">
            <QuickAction
              icon={ScanLine}
              label="Scan QR"
              href="/customer/scan"
              variant="primary"
            />
            <QuickAction
              icon={CreditCard}
              label="All Cards"
              href="/customer/cards"
            />
            <QuickAction
              icon={Compass}
              label="Explore"
              href="/customer/search"
            />
          </div>
        </section>

        {/* More Programs section — remaining cards as compact tiles */}
        {others.length > 0 && (
          <section>
            <SectionHeader title="More Programs" />
            <motion.div
              variants={listVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-3"
            >
              {others.map((card) => (
                <motion.div key={card.cardId} variants={itemVariants}>
                  <StampCard
                    programId={card.programId}
                    merchantName={card.merchantName}
                    programName="Loyalty Program"
                    logoUrl={card.logoUrl}
                    stampCount={card.currentStamps}
                    totalStamps={card.stampsRequired}
                    rewardDescription={card.rewardDescription}
                    variant="compact"
                    onTap={() =>
                      router.push(
                        `/customer/cards/${card.cardId}`,
                      )
                    }
                  />
                </motion.div>
              ))}
            </motion.div>
          </section>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
