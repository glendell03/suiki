'use client';

import { useState, useCallback } from 'react';

interface AddressDisplayProps {
  /** Full SUI address string (e.g. "0x1a2b3c…"). */
  address: string;
  /**
   * Number of leading characters to show (after "0x").
   * Includes the "0x" prefix — so 6 shows "0x1a2b".
   * Defaults to 6.
   */
  prefixLength?: number;
  /**
   * Number of trailing characters to show.
   * Defaults to 4.
   */
  suffixLength?: number;
  /** Additional Tailwind classes applied to the root element. */
  className?: string;
}

/**
 * AddressDisplay — shows a truncated SUI address with copy-to-clipboard.
 *
 * Truncation format: first `prefixLength` chars + "…" + last `suffixLength`
 * chars. A checkmark briefly replaces the copy icon on success.
 *
 * Uses the `.font-address` utility class from globals.css for consistent
 * monospace rendering across all wallet address displays in the app.
 *
 * @example
 * <AddressDisplay address={account.address} />
 */
export function AddressDisplay({
  address,
  prefixLength = 6,
  suffixLength = 4,
  className = '',
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const truncated =
    address.length > prefixLength + suffixLength + 1
      ? `${address.slice(0, prefixLength)}…${address.slice(-suffixLength)}`
      : address;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      /* Reset the checkmark after 2 s — long enough to register, short
       * enough not to confuse a second tap. */
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard API unavailable (e.g., insecure context).
       * Fail silently — the address is still visible to copy manually. */
    }
  }, [address]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Nakopya na!' : `Kopyahin ang address: ${address}`}
      title={address}
      className={[
        'group inline-flex items-center gap-2',
        'rounded-lg border border-[--color-border] bg-[--color-bg-surface]',
        'px-3 py-1.5',
        'transition-colors duration-150',
        'hover:border-[--color-primary] hover:bg-[--color-bg-elevated]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary] focus-visible:ring-offset-2 focus-visible:ring-offset-[--color-bg-base]',
        'active:opacity-75',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Truncated address text */}
      <span className="font-address text-[--color-text-primary]">{truncated}</span>

      {/* Copy / checkmark icon */}
      <span
        className="flex-shrink-0 text-[--color-text-muted] transition-colors duration-150 group-hover:text-[--color-primary]"
        aria-hidden="true"
      >
        {copied ? (
          /* Checkmark — success state */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 text-[--color-success]"
          >
            <polyline points="2.5 8.5 6.5 12.5 13.5 4.5" />
          </svg>
        ) : (
          /* Copy icon */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <rect x="5" y="5" width="8" height="9" rx="1" />
            <path d="M3 11V3a1 1 0 0 1 1-1h8" />
          </svg>
        )}
      </span>

      {/* Accessible live region — announces copy result to screen readers */}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Nakopya na ang address!' : ''}
      </span>
    </button>
  );
}
