'use client';

import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { useCurrentAccount, useWalletConnection } from '@mysten/dapp-kit-react';

/**
 * ConnectWallet — mobile-first wallet connection button for Suiki.
 *
 * Wraps the dapp-kit-react ConnectButton with Filipino-friendly copy and
 * full-width mobile layout. When connected, shows the wallet name and a
 * truncated address. When disconnected, renders the primary "I-connect"
 * CTA. All layout and color decisions come from CSS custom properties
 * defined in globals.css — no hardcoded values.
 */
export function ConnectWallet() {
  const account = useCurrentAccount();
  const connection = useWalletConnection();

  /* Truncate: first 6 chars + "..." + last 4 chars.
   * A SUI address is 66 chars (0x + 64 hex). Showing the tail makes it
   * easier for Maria to visually verify against a known address. */
  const truncated = account?.address
    ? `${account.address.slice(0, 6)}…${account.address.slice(-4)}`
    : null;

  const walletName =
    connection.status === 'connected' ? connection.wallet?.name ?? 'Wallet' : null;

  return (
    <div className="w-full">
      {account ? (
        /* ── Connected state ──────────────────────────────────────────── */
        <div className="flex w-full flex-col items-stretch gap-2">
          {/* Wallet identity badge */}
          <div
            className="flex items-center gap-3 rounded-xl border border-[--color-border] bg-[--color-bg-surface] px-4 py-3"
            aria-label={`Nakakonekta: ${account.address}`}
          >
            {/* Green connected indicator dot */}
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[--color-success]"
              aria-hidden="true"
            />
            <div className="flex min-w-0 flex-col">
              {walletName && (
                <span className="text-xs font-medium text-[--color-text-secondary]">
                  {walletName}
                </span>
              )}
              <span className="font-address truncate text-sm text-[--color-text-primary]">
                {truncated}
              </span>
            </div>
          </div>

          {/* Disconnect — rendered via ConnectButton so the kit manages
              the actual disconnect flow. We override its slot content with
              Filipino copy and ghost styling. */}
          <ConnectButton className="w-full">
            <span
              className="inline-flex w-full items-center justify-center rounded-xl border border-[--color-border] bg-transparent px-6 py-3 text-sm font-semibold text-[--color-text-secondary] transition-colors duration-150 hover:border-[--color-error] hover:text-[--color-error] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary] focus-visible:ring-offset-2 focus-visible:ring-offset-[--color-bg-base] active:opacity-75"
            >
              Idiskonekta
            </span>
          </ConnectButton>
        </div>
      ) : (
        /* ── Disconnected state ───────────────────────────────────────── */
        <ConnectButton className="w-full">
          <span
            className="inline-flex w-full items-center justify-center rounded-xl bg-[--color-primary] px-6 py-3.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[--color-primary-dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary-light] focus-visible:ring-offset-2 focus-visible:ring-offset-[--color-bg-base] active:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          >
            {connection.status === 'connecting'
              ? 'Nagkokonekta…'
              : 'I-connect ang Wallet'}
          </span>
        </ConnectButton>
      )}
    </div>
  );
}
