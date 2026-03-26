'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMyPrograms } from '@/hooks/use-my-programs';
import { WalletGuard } from '@/components/wallet-guard';
import { Button } from '@/components/ui/button';
import type { StampProgram } from '@/types/sui';

// ---------------------------------------------------------------------------
// Sub-components — kept small and focused (≤50 lines each)
// ---------------------------------------------------------------------------

/** Placeholder shown while programs are loading. */
function ProgramCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[--color-border] bg-[--color-bg-surface] p-5">
      <div className="flex items-center gap-4">
        {/* Logo placeholder */}
        <div className="h-12 w-12 shrink-0 rounded-xl bg-[--color-bg-elevated]" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-4 w-3/5 rounded bg-[--color-bg-elevated]" />
          <div className="h-3 w-2/5 rounded bg-[--color-bg-elevated]" />
        </div>
      </div>
    </div>
  );
}

/** Single program card with logo, name, and issued count. */
function ProgramCard({ program }: { program: StampProgram }) {
  const [imgError, setImgError] = useState(false);
  const showFallback = !program.logoUrl || imgError;

  return (
    <Link
      href={`/merchant/${program.objectId}`}
      className="flex items-center gap-4 rounded-2xl border border-[--color-border] bg-[--color-bg-surface] p-5 transition-colors hover:border-[--color-primary] hover:bg-[--color-bg-elevated]"
      aria-label={`View program: ${program.name}`}
    >
      {/* Logo with emoji fallback — conditional rendering avoids DOM mutation */}
      {showFallback ? (
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[--color-bg-elevated] text-2xl"
          aria-hidden="true"
        >
          🏪
        </div>
      ) : (
        <img
          src={program.logoUrl}
          alt={`${program.name} logo`}
          className="h-12 w-12 shrink-0 rounded-xl object-cover"
          onError={() => setImgError(true)}
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[--color-text-primary]">
          {program.name}
        </p>
        <p className="mt-0.5 text-sm text-[--color-text-secondary]">
          {program.totalIssued} stamp{program.totalIssued !== 1 ? 's' : ''} issued
        </p>
      </div>

      {/* Chevron — indicates navigability */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-5 w-5 shrink-0 text-[--color-text-muted]"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
          clipRule="evenodd"
        />
      </svg>
    </Link>
  );
}

/** Empty state shown when the merchant has no programs yet. */
function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-dashed border-[--color-border] bg-[--color-bg-surface] px-8 py-14 text-center">
      <span className="text-5xl" aria-hidden="true">🏪</span>
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-[--color-text-primary]">No programs yet</p>
        <p className="text-sm text-[--color-text-secondary]">
          Create your first loyalty program to start issuing stamps.
        </p>
      </div>
      <Link href="/merchant/create">
        <Button variant="primary">Create your first loyalty program</Button>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard content — rendered only when wallet is connected
// ---------------------------------------------------------------------------

/**
 * Inner dashboard rendered inside WalletGuard once the account is available.
 * Handles loading, error, and data states for the merchant's program list.
 */
function DashboardContent() {
  const { data: programs, isLoading, isError, error, refetch } = useMyPrograms();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[--color-text-primary]">
          Merchant Dashboard
        </h1>
        <Link href="/merchant/create">
          <Button variant="primary" className="text-xs">
            + Create New Program
          </Button>
        </Link>
      </div>

      {/* Loading state — 3 skeleton cards */}
      {isLoading && (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading programs">
          <ProgramCardSkeleton />
          <ProgramCardSkeleton />
          <ProgramCardSkeleton />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-2xl border border-[--color-error] bg-[--color-bg-surface] p-5 text-center">
          <p className="mb-4 text-sm text-[--color-error]">
            {error?.message ?? 'Failed to load programs.'}
          </p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && programs?.length === 0 && <EmptyState />}

      {/* Program list */}
      {!isLoading && !isError && programs && programs.length > 0 && (
        <div className="flex flex-col gap-3">
          {programs.map((program) => (
            <ProgramCard key={program.objectId} program={program} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

/**
 * Merchant dashboard page — lists all loyalty programs created by the
 * currently connected wallet. Guarded by WalletGuard so the connect prompt
 * is shown when no wallet is present.
 */
export default function MerchantPage() {
  return (
    <WalletGuard heading="Merchant Dashboard">
      <DashboardContent />
    </WalletGuard>
  );
}
