"use client";

/**
 * /customer/search — Merchant Discovery and Search (V2 SUI Water Design)
 *
 * Browse and search available stamp programs. Uses PageHeader, SearchBar,
 * and BottomNav from the shared component library.
 *
 * BUG FIX: V1 was missing BottomNav entirely. V2 adds it back.
 *
 * NOTE: fetchAllPrograms returns an empty array as placeholder until the
 * backend exposes a global program index.
 */

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Search, Store, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SearchBar } from "@/components/search-bar";
import { MerchantAvatar } from "@/components/merchant-avatar";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";
import { BottomNav } from "@/components/bottom-nav";
import type { ProgramWithMetadata } from "@/types/db";

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

/**
 * Fetch all available stamp programs for discovery.
 *
 * TODO: Replace with a real getAllPrograms() query when the backend exposes
 * a global program index (e.g. via a ProgramCreated event scan without
 * sender filter). For now returns an empty array as placeholder.
 */
async function fetchAllPrograms(): Promise<ProgramWithMetadata[]> {
  return [];
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function MerchantSearchPage() {
  const { data: programs, isLoading, isError, error } = useQuery<ProgramWithMetadata[], Error>({
    queryKey: ["all-programs"],
    queryFn: fetchAllPrograms,
    staleTime: 60_000,
  });

  const [query, setQuery] = useState("");

  const filtered =
    programs?.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())) ?? [];

  const hasQuery = query.trim().length > 0;
  const hasResults = filtered.length > 0;

  return (
    <div className="min-h-dvh flex flex-col bg-(--color-bg-base)">
      <PageHeader title="Explore Merchants" />

      {/* Sticky search bar below fixed header */}
      <div className="sticky top-14 z-30 bg-(--color-bg-base) px-4 py-3 border-b border-(--color-border)">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search merchants..."
          autoFocus
        />
      </div>

      {/* Scrollable content */}
      <div className="overflow-y-auto pb-nav px-4 pt-3 flex flex-col gap-3">
        {/* Offset for fixed PageHeader */}
        <div className="pt-14" />

        {/* Loading skeletons */}
        {isLoading && <LoadingSkeletons />}

        {/* Error state */}
        {isError && (
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load merchants"
            description={error?.message ?? "Something went wrong. Please try again."}
            action={{ label: "Retry", onClick: () => window.location.reload() }}
          />
        )}

        {/* Search results */}
        {!isLoading && !isError && hasResults && (
          <MerchantList programs={filtered} />
        )}

        {/* Empty: no search results */}
        {!isLoading && !isError && hasQuery && !hasResults && (
          <EmptyState
            icon={Search}
            title="No merchants found"
            description={`No results for "${query}"`}
          />
        )}

        {/* Empty: no programs at all */}
        {!isLoading && !isError && !hasQuery && !hasResults && (
          <EmptyState
            icon={Store}
            title="No merchants yet"
            description="No Suiki merchants in your area yet. Check back soon!"
          />
        )}
      </div>

      <BottomNav />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stagger animation variants
// ---------------------------------------------------------------------------

/** Stagger animation for the merchant list container. */
const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
};

/** Spring entrance animation for each merchant row. */
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 380, damping: 28 },
  },
};

// ---------------------------------------------------------------------------
// Merchant list
// ---------------------------------------------------------------------------

/** Renders the filtered list of merchant program tiles with stagger entrance. */
function MerchantList({ programs }: { programs: ProgramWithMetadata[] }) {
  return (
    <motion.ul
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-3"
      role="list"
      aria-label="Merchant programs"
    >
      {programs.map((program) => (
        <motion.li key={program.programId} variants={itemVariants} role="listitem">
          <MerchantRow program={program} />
        </motion.li>
      ))}
    </motion.ul>
  );
}

/** Single merchant row tile linking to the program detail page. */
function MerchantRow({ program }: { program: ProgramWithMetadata }) {
  return (
    <Link href={`/merchant/${program.programId}`}>
      <div className="flex items-center gap-3 bg-(--color-surface) border border-(--color-border) rounded-(--radius-xl) p-4 tap-target active:scale-[0.98] transition-transform">
        <MerchantAvatar logoUrl={program.logoUrl} name={program.name} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-(--color-text-primary) truncate">
            {program.name}
          </p>
          <p className="text-[13px] text-(--color-text-secondary)">
            {program.stampsRequired} stamp{program.stampsRequired !== 1 ? "s" : ""} required
          </p>
        </div>
        <Badge variant="active">Active</Badge>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

/** Three card skeletons shown during initial data fetch. */
function LoadingSkeletons() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading merchants">
      <Skeleton variant="card" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}
