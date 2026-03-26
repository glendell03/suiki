"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useQueryClient } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { motion } from "framer-motion";
import { WalletGuard } from "@/components/wallet-guard";
import { BottomNav } from "@/components/bottom-nav";
import { MerchantCard } from "@/components/merchant-card";
import { SearchBar } from "@/components/search-bar";
import { EmptyState } from "@/components/empty-state";
import { FeatureGrid } from "@/components/feature-grid";
import { SiteHeader } from "@/app/site-header";
import { useMyCards } from "@/hooks/use-my-cards";
import { useSponsoredTx } from "@/hooks/use-sponsored-tx";
import { buildRedeem } from "@/lib/transactions";
import type { StampCard } from "@/types/sui";

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

function CustomerDashboard() {
  const router = useRouter();
  const account = useCurrentAccount();
  const queryClient = useQueryClient();
  const { data: cards, isLoading, error } = useMyCards();
  const {
    executeSponsoredTx,
    isPending: isRedeemPending,
    error: redeemError,
  } = useSponsoredTx();

  const [redeemingCardId, setRedeemingCardId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const isRedeemingRef = useRef(false);

  const handleRedeem = async (card: StampCard) => {
    if (!account || isRedeemingRef.current) return;
    isRedeemingRef.current = true;
    setRedeemingCardId(card.objectId);
    try {
      await executeSponsoredTx(
        buildRedeem(account.address, card.programId, card.objectId),
      );
      await queryClient.invalidateQueries({
        queryKey: ["cards", account.address],
      });
    } finally {
      isRedeemingRef.current = false;
      setRedeemingCardId(null);
    }
  };

  const handleToggle = (cardId: string) => {
    setExpandedCardId((prev) => (prev === cardId ? null : cardId));
  };

  /* Sort by progress descending, then filter by search query. */
  const sortedCards = [...(cards ?? [])].sort((a, b) => {
    const aProgress =
      (a.currentStamps ?? 0) / Math.max(a.stampsRequired ?? 1, 1);
    const bProgress =
      (b.currentStamps ?? 0) / Math.max(b.stampsRequired ?? 1, 1);
    return bProgress - aProgress;
  });

  const filteredCards = searchQuery
    ? sortedCards.filter((c) =>
        c.merchantName.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : sortedCards;

  /* Derive short display name from wallet address. */
  const shortName = account?.address ? account.address.slice(0, 6) : "there";

  return (
    <div className="page-gradient flex min-h-dvh flex-col">
      <SiteHeader />

      <div className="flex-1 overflow-y-auto pb-nav px-5 pt-1">
        {/* Greeting -- Plus Jakarta Sans via --font-display */}
        <section className="mb-5">
          <h1
            className="text-[28px] font-extrabold tracking-tight text-[--color-text-primary] leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Hey,{" "}
            <span className="text-[--color-primary]">{shortName}!</span>
          </h1>
          <p className="mt-1 text-sm text-[--color-text-secondary]">
            Let&apos;s earn more stamps today
          </p>
        </section>

        {/* Search */}
        <div className="mb-5">
          <SearchBar
            placeholder="Search your cards..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>

        {/* 2x2 Feature grid */}
        <div className="mb-6">
          <FeatureGrid />
        </div>

        {/* Redeem error */}
        {redeemError && (
          <div className="mb-4 rounded-xl border border-[--color-error]/30 bg-[--color-error]/10 px-4 py-3">
            <p className="text-sm text-[--color-error]">
              {redeemError.message}
            </p>
          </div>
        )}

        {/* My Cards section header with "View all" link */}
        <div className="mb-3 flex items-center justify-between">
          <h2
            className="text-base font-bold text-[--color-text-primary]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            My Cards
          </h2>
          <Link
            href="/customer/cards"
            className="text-xs font-medium text-[--color-primary] hover:opacity-80"
          >
            View all &rarr;
          </Link>
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <ul
            className="flex flex-col gap-3"
            aria-busy="true"
            aria-label="Loading stamp cards"
          >
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-[72px] animate-pulse rounded-2xl border border-[--color-border] bg-[--color-bg-surface]"
                aria-hidden="true"
              />
            ))}
          </ul>
        )}

        {/* Fetch error */}
        {!isLoading && error && (
          <p className="text-center text-sm text-[--color-error]">
            {error.message}
          </p>
        )}

        {/* Empty state */}
        {!isLoading && !error && cards?.length === 0 && (
          <EmptyState
            icon={Store}
            title="No stamp cards yet"
            description="Visit a merchant and scan their QR code to start collecting stamps."
            action={{
              label: "Scan a merchant QR",
              onClick: () => router.push("/customer/scan"),
            }}
          />
        )}

        {/* Card list with staggered Framer Motion entrance */}
        {!isLoading && !error && filteredCards.length > 0 && (
          <motion.ul
            variants={listVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-3"
          >
            {filteredCards.map((card) => (
              <motion.li key={card.objectId} variants={itemVariants}>
                <MerchantCard
                  merchantName={card.merchantName}
                  category="Loyalty Card"
                  logoUrl={card.merchantLogo}
                  filledStamps={card.currentStamps ?? 0}
                  totalStamps={card.stampsRequired ?? 9}
                  isExpanded={expandedCardId === card.objectId}
                  onToggle={() => handleToggle(card.objectId)}
                  onShowQR={() => {
                    if (account) void handleRedeem(card);
                  }}
                />
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
