'use client';

import Link from 'next/link';
import { ConnectWallet } from '@/components/connect-wallet';

/**
 * SiteHeader — sticky top navigation bar for all Suiki pages.
 *
 * Marked 'use client' because ConnectWallet relies on dapp-kit-react hooks
 * (useCurrentAccount, useWalletConnection). Kept as a focused leaf component
 * so the parent RootLayout remains a Server Component.
 *
 * The backdrop blur gives it a "frosted glass" appearance over page content
 * while the border-b provides a subtle separator on the Suiki dark background.
 */
export function SiteHeader() {
  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-50 h-16',
        'flex items-center justify-between px-5',
        'border-b border-[--color-border]',
        'bg-[--color-bg-base]/80 backdrop-blur-md',
      ].join(' ')}
    >
      {/* Brand */}
      <Link
        href="/"
        className={[
          'text-lg font-bold text-[--color-text-primary]',
          'transition-opacity hover:opacity-80 focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-[--color-primary] rounded',
        ].join(' ')}
        aria-label="Suiki home"
      >
        Suiki
      </Link>

      {/* Wallet connection — constrained width so it doesn't dominate the header */}
      <div className="w-auto max-w-[180px]">
        <ConnectWallet />
      </div>
    </header>
  );
}
