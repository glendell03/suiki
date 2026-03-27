// src/app/merchant/page.tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, ArrowRight, Store } from "lucide-react";
import { useAccount } from "@/hooks/use-account";
import { useMyPrograms } from "@/hooks/use-my-programs";
import { WalletGuard } from "@/components/wallet-guard";
import { WalletDropdown } from "@/components/wallet-dropdown";
import { MerchantAvatar } from "@/components/merchant-avatar";
import { Badge } from "@/components/badge";
import { Skeleton } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";

// ---------------------------------------------------------------------------
// Stagger animation variants
// ---------------------------------------------------------------------------

/** Stagger animation for the program list container. */
const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
};

/** Spring entrance animation for each program tile. */
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 380, damping: 28 },
  },
};

/**
 * Merchant landing hero section with brand gradient, watermark, and wallet avatar.
 */
function HeroSection() {
  return (
    <section
      className="relative flex flex-col items-center justify-center px-5"
      style={{
        background: "var(--color-brand)",
        minHeight: "30vh",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* Watermark — clipped inside its own div so the section allows dropdown overflow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <span
          aria-hidden="true"
          className="absolute select-none"
          style={{
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 100,
            color: "rgba(255, 255, 255, 0.10)",
            lineHeight: 1,
          }}
        >
          水
        </span>
      </div>

      {/* Wallet avatar — top right */}
      <div className="absolute top-4 right-4" style={{ top: "max(16px, env(safe-area-inset-top))" }}>
        <WalletDropdown variant="light" />
      </div>

      {/* Title block */}
      <h1
        className="text-white text-center"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 28,
          lineHeight: 1.15,
        }}
      >
        Suiki for Merchants
      </h1>

      <p
        className="mt-2 text-center"
        style={{ fontSize: 15, color: "rgba(255, 255, 255, 0.75)" }}
      >
        Build loyalty. Keep customers.
      </p>
    </section>
  );
}

/**
 * CTA card linking to the create-program flow.
 */
function CreateProgramCard() {
  return (
    <Link href="/merchant/create" className="block">
      <div
        className="tap-target flex items-center gap-4 bg-(--color-surface) p-4 transition-transform active:scale-[0.98]"
        style={{
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Plus icon */}
        <div
          className="shrink-0 flex items-center justify-center rounded-full"
          style={{
            width: 44,
            height: 44,
            background: "var(--color-brand-subtle)",
          }}
        >
          <Plus size={24} aria-hidden={true} style={{ color: "var(--color-brand)" }} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p
            className="text-(--color-text-primary)"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 17,
            }}
          >
            Create New Program
          </p>
          <p
            className="text-(--color-text-secondary) mt-0.5"
            style={{ fontSize: 13 }}
          >
            Set up your loyalty stamp card
          </p>
        </div>

        {/* Arrow */}
        <ArrowRight
          size={20}
          className="shrink-0 text-(--color-text-muted)"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

/**
 * Single program tile linking to the program detail page.
 */
function ProgramTile({
  program,
}: {
  program: {
    objectId: string;
    name: string;
    logoUrl: string;
    totalIssued: number;
  };
}) {
  return (
    <Link href={`/merchant/${program.objectId}`} className="block">
      <div
        className="tap-target flex items-center gap-3 bg-(--color-surface) p-4 transition-transform active:scale-[0.98]"
        style={{
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <MerchantAvatar
          logoUrl={program.logoUrl}
          name={program.name}
          size={40}
        />

        <div className="flex-1 min-w-0">
          <p
            className="truncate text-(--color-text-primary) font-semibold"
            style={{ fontSize: 15, fontFamily: "var(--font-display)" }}
          >
            {program.name}
          </p>
          <p
            className="text-(--color-text-secondary) mt-0.5"
            style={{ fontSize: 13 }}
          >
            {program.totalIssued} stamp{program.totalIssued !== 1 ? "s" : ""}{" "}
            issued
          </p>
        </div>

        <Badge variant="active">Active</Badge>
      </div>
    </Link>
  );
}

/**
 * Main dashboard content rendered after wallet guard passes.
 * Handles loading, empty, and populated states for the program list.
 */
function DashboardContent() {
  const account = useAccount();
  const { data: programs, isLoading } = useMyPrograms();

  return (
    <div className="min-h-dvh bg-(--color-bg-base)">
      {/* Hero */}
      {account && <HeroSection />}

      {/* Content */}
      <div className="mx-auto w-full max-w-[430px] flex flex-col gap-4 px-4 py-6">
        {/* Create CTA -- always visible */}
        <CreateProgramCard />

        {/* Loading state */}
        {isLoading && (
          <div
            className="flex flex-col gap-3"
            aria-busy="true"
            aria-label="Loading programs"
          >
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
        )}

        {/* Program list */}
        {!isLoading && programs && programs.length > 0 && (
          <>
            <h2
              className="text-(--color-text-secondary) mt-2"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Your Programs
            </h2>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="flex flex-col gap-3"
              role="list"
              aria-label="Your programs"
            >
              {programs.map((program) => (
                <motion.div key={program.objectId} variants={itemVariants} role="listitem">
                  <ProgramTile program={program} />
                </motion.div>
              ))}
            </motion.div>
          </>
        )}

        {/* Empty state */}
        {!isLoading && programs?.length === 0 && (
          <EmptyState
            icon={Store}
            title="No programs yet"
            description="Create your first loyalty stamp program to start rewarding customers."
            action={{ label: "Create Program", href: "/merchant/create" }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Merchant landing page -- lists all loyalty programs created by the connected
 * wallet. Guarded by WalletGuard so a connect prompt is shown when no wallet
 * is present.
 */
export default function MerchantPage() {
  return (
    <WalletGuard heading="Merchant Dashboard">
      <DashboardContent />
    </WalletGuard>
  );
}
