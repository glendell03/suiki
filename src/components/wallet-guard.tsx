'use client';

import type { ReactNode } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { ConnectWallet } from './connect-wallet';

interface WalletGuardProps {
  /** Content to render when a wallet is connected. */
  children: ReactNode;
  /**
   * Optional heading shown in the connect prompt.
   * Defaults to a generic Filipino prompt.
   */
  heading?: string;
  /**
   * Optional supporting copy shown below the heading.
   * Defaults to a brief Filipino trust message.
   */
  description?: string;
}

/**
 * WalletGuard — renders children only when a wallet is connected.
 *
 * When no account is detected it shows a centered connect prompt using
 * the ConnectWallet component. All surfaces use the Suiki dark-first
 * design tokens from globals.css; no colors are hardcoded.
 *
 * Usage:
 *   <WalletGuard>
 *     <MerchantDashboard />
 *   </WalletGuard>
 */
export function WalletGuard({
  children,
  heading = 'Ikonekta ang inyong Wallet',
  description = 'Kailangan ang wallet para magpatuloy. Ligtas at mabilis.',
}: WalletGuardProps) {
  const account = useCurrentAccount();

  if (account) {
    return <>{children}</>;
  }

  return (
    /* Full-viewport centered layout — works from 375 px upward.
     * min-h-[100dvh] is the PWA-safe viewport unit used in globals.css. */
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-[--color-border] bg-[--color-bg-surface] px-6 py-10 shadow-lg">

        {/* Brand mark / wallet icon */}
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[--color-primary]"
          aria-hidden="true"
        >
          {/* Wallet icon — inline SVG keeps the bundle small, no icon lib needed */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8 text-white"
            aria-label="Wallet icon"
          >
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
            <circle cx="18" cy="15" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </div>

        {/* Copy */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-xl font-semibold text-[--color-text-primary]">
            {heading}
          </h2>
          <p className="text-sm leading-relaxed text-[--color-text-secondary]">
            {description}
          </p>
        </div>

        {/* CTA — full-width on all viewport sizes */}
        <div className="w-full">
          <ConnectWallet />
        </div>

        {/* Trust footer */}
        <p className="text-center text-xs text-[--color-text-muted]">
          Ang inyong mga stamps ay nasa SUI blockchain — safe at hindi mawawala.
        </p>
      </div>
    </div>
  );
}
