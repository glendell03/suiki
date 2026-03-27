'use client';

import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Layers, Shield, Gift } from 'lucide-react';

// Dynamic import with ssr: false — @mysten/dapp-kit-react/ui accesses `window`
// at module evaluation time, which crashes Next.js SSR.
const ConnectButton = dynamic(
  () => import('@mysten/dapp-kit-react/ui').then((m) => m.ConnectButton),
  { ssr: false },
);
import { useAccount } from '@/hooks/use-account';

interface WalletGuardProps {
  children: ReactNode;
  heading?: string;
  description?: string;
}

const FEATURES = [
  { icon: Layers, label: 'Stamp cards' },
  { icon: Shield, label: 'On-chain' },
  { icon: Gift, label: 'Earn rewards' },
] as const;

export function WalletGuard({
  children,
  heading = 'Connect your wallet',
  description = 'Sign in to continue',
}: WalletGuardProps) {
  const account = useAccount();

  if (account) return <>{children}</>;

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: 'var(--color-brand)' }}
    >
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div
        className="flex-1 relative flex flex-col items-center justify-center px-8 overflow-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Background watermark */}
        <span
          aria-hidden="true"
          className="absolute pointer-events-none select-none"
          style={{
            right: -20,
            bottom: -30,
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 220,
            color: 'rgba(255,255,255,0.06)',
            lineHeight: 1,
          }}
        >
          水
        </span>

        {/* Wordmark */}
        <div className="flex items-center gap-2.5 mb-7">
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 38,
              color: 'rgba(255,255,255,0.92)',
              lineHeight: 1,
            }}
          >
            水
          </span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 30,
              color: 'white',
              letterSpacing: '-0.02em',
            }}
          >
            Suiki
          </span>
        </div>

        {/* Heading */}
        <h1
          className="text-white text-center"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 28,
            lineHeight: 1.2,
          }}
        >
          {heading}
        </h1>

        {/* Description */}
        <p
          className="mt-3 text-center"
          style={{ fontSize: 15, color: 'rgba(255,255,255,0.68)', lineHeight: 1.5 }}
        >
          {description}
        </p>

        {/* Feature pills */}
        <div className="flex gap-2 mt-8 flex-wrap justify-center">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 px-3 py-1.5"
              style={{
                background: 'rgba(255,255,255,0.12)',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              <Icon size={13} color="rgba(255,255,255,0.85)" />
              <span
                style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <div
        className="mx-auto w-full max-w-[430px] px-5 flex flex-col gap-3"
        style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}
      >
        {/*
         * Theme the dapp-kit ConnectButton white via CSS custom properties.
         * --primary / --primary-foreground pierce the web component's shadow DOM.
         * ::part(trigger) in globals.css sets width: 100% and height: 52px.
         */}
        <div
          style={{
            '--primary': 'white',
            '--primary-foreground': 'var(--color-brand)',
            '--radius': '16px',
          } as React.CSSProperties}
        >
          <ConnectButton className="block w-full" />
        </div>

        <p
          className="text-center"
          style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)', lineHeight: 1.6 }}
        >
          Your stamps live on the SUI blockchain — safe and always yours.
        </p>
      </div>
    </div>
  );
}
