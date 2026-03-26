'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Store } from 'lucide-react';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { WalletGuard } from '@/components/wallet-guard';
import { BottomNav } from '@/components/bottom-nav';
import { GlassCard } from '@/components/glass-card';
import { ProgressBarStamps } from '@/components/progress-bar-stamps';
import { StampGrid } from '@/components/stamp-grid';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/app/site-header';
import { useMyCards } from '@/hooks/use-my-cards';
import type { StampCard } from '@/types/sui';

export default function CardsProgressPage() {
  return (
    <WalletGuard
      heading="Connect your wallet"
      description="To see your loyalty cards"
    >
      <CardsProgressDashboard />
    </WalletGuard>
  );
}

function CardsProgressDashboard() {
  const { data: cards, isLoading, error } = useMyCards();

  const sortedCards = cards
    ? [...cards].sort((a, b) => {
        const ratioA = a.currentStamps / Math.max(a.stampsRequired, 1);
        const ratioB = b.currentStamps / Math.max(b.stampsRequired, 1);
        return ratioB - ratioA;
      })
    : [];

  return (
    <div className="page-gradient flex min-h-dvh flex-col">
      <SiteHeader />

      <div className="flex-1 overflow-y-auto pb-nav px-5 pt-2">
        <h1 className="mb-5 text-2xl font-extrabold tracking-tight text-[--color-text-primary]">
          My Cards
        </h1>

        {isLoading && (
          <ul className="flex flex-col gap-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-[72px] animate-pulse rounded-2xl border border-[--color-border] bg-[--color-bg-surface]"
                aria-hidden="true"
              />
            ))}
          </ul>
        )}

        {!isLoading && error && (
          <p className="text-center text-sm text-[--color-error]">{error.message}</p>
        )}

        {!isLoading && !error && sortedCards.length === 0 && (
          <div className="flex flex-col items-center gap-5 py-16 text-center">
            <span className="text-5xl" aria-hidden="true">🃏</span>
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-[--color-text-primary]">No loyalty cards yet</p>
              <p className="text-sm text-[--color-text-secondary]">
                Visit a merchant and scan their QR code to start.
              </p>
            </div>
            <Link href="/customer/scan">
              <Button variant="primary">Scan a Merchant QR</Button>
            </Link>
          </div>
        )}

        {!isLoading && !error && sortedCards.length > 0 && (
          <ul className="flex flex-col gap-3" aria-label="Loyalty cards">
            {sortedCards.map((card) => (
              <li key={card.objectId}>
                <CardAccordionRow card={card} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function CardAccordionRow({ card }: { card: StampCard }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isComplete = card.currentStamps >= card.stampsRequired;
  const cardId = String(card.objectId);

  return (
    <GlassCard padding="none" className="overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        aria-controls={`card-body-${cardId}`}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[--color-bg-elevated]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary] focus-visible:ring-inset"
      >
        {/* Merchant avatar */}
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[--color-bg-elevated] overflow-hidden"
          aria-hidden="true"
        >
          {card.merchantLogo ? (
            <img
              src={card.merchantLogo}
              alt={card.merchantName}
              className="h-11 w-11 rounded-2xl object-cover"
            />
          ) : (
            <Store size={20} className="text-[--color-text-muted]" />
          )}
        </div>

        {/* Name + count */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[--color-text-primary] truncate">
            {card.merchantName || 'Unknown Merchant'}
          </p>
          <p className="text-xs text-[--color-text-secondary]">
            {card.currentStamps}/{card.stampsRequired} stamps
            {isComplete && (
              <span className="ml-1.5 text-[--color-accent-loyalty] font-semibold">
                · Ready to redeem!
              </span>
            )}
          </p>
        </div>

        {/* Progress % pill */}
        <span
          className={[
            'flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full',
            isComplete
              ? 'bg-[--color-accent-loyalty] text-[--color-bg-base]'
              : 'bg-[--color-bg-elevated] text-[--color-text-secondary]',
          ].join(' ')}
        >
          {Math.min(Math.round((card.currentStamps / Math.max(card.stampsRequired, 1)) * 100), 100)}%
        </span>

        {/* Chevron */}
        {isExpanded ? (
          <ChevronUp size={16} className="flex-shrink-0 text-[--color-text-muted]" />
        ) : (
          <ChevronDown size={16} className="flex-shrink-0 text-[--color-text-muted]" />
        )}
      </button>

      {/* Expanded body */}
      <div
        id={`card-body-${cardId}`}
        style={{
          gridTemplateRows: isExpanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 250ms ease',
        }}
        className="grid"
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-4 border-t border-[--glass-border] px-4 pb-4 pt-4">
            <StampGrid
              totalSlots={card.stampsRequired}
              filledSlots={card.currentStamps}
              size="sm"
            />

            <ProgressBarStamps
              total={card.stampsRequired}
              filled={card.currentStamps}
              showLabel
            />

            <div className="flex gap-3">
              <Link href={`/customer/cards/${cardId}`} className="flex-1">
                <Button variant="primary" className="w-full rounded-full text-sm">
                  Show QR
                </Button>
              </Link>

              {isComplete && (
                <Link href={`/customer/cards/${cardId}/reward`} className="flex-1">
                  <Button variant="loyalty" className="w-full rounded-full text-sm">
                    Claim Reward
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
