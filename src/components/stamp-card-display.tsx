'use client';

import type { StampCard } from '@/types/sui';
import { StampProgress } from '@/components/stamp-progress';

interface StampCardDisplayProps {
  /** The customer's stamp card to render. */
  card: StampCard;
  /** Called when the customer taps the redeem button. */
  onRedeem?: () => void;
  /** Set to true while the redeem transaction is in flight. */
  isRedeeming?: boolean;
}

/**
 * StampCardDisplay — renders a single loyalty stamp card for the customer view.
 *
 * Shows the merchant logo (falling back to a shop emoji), merchant name,
 * stamp progress, lifetime earnings, and — when enough stamps are collected —
 * a gold "Redeem Reward" button.
 */
export function StampCardDisplay({
  card,
  onRedeem,
  isRedeeming = false,
}: StampCardDisplayProps) {
  const canRedeem = card.currentStamps >= card.stampsRequired;
  const rewardsLabel =
    card.totalEarned === 1
      ? '1 reward earned'
      : `${card.totalEarned} rewards earned`;

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-[--color-border] bg-[--color-bg-surface] p-5">
      {/* Merchant identity row */}
      <div className="flex items-center gap-3">
        <MerchantLogo src={card.merchantLogo} alt={card.merchantName} />

        <div className="flex flex-col min-w-0">
          <h3 className="font-semibold text-[--color-text-primary] truncate">
            {card.merchantName || 'Unknown Merchant'}
          </h3>
          <p className="text-xs text-[--color-text-muted]">{rewardsLabel}</p>
        </div>
      </div>

      {/* Stamp progress */}
      <StampProgress
        current={card.currentStamps}
        required={card.stampsRequired}
      />

      {/* Redeem button — only visible when reward is available and handler provided */}
      {canRedeem && onRedeem && (
        <button
          type="button"
          onClick={onRedeem}
          disabled={isRedeeming}
          className={[
            'w-full rounded-xl px-4 py-3 text-sm font-semibold',
            'bg-[--color-accent-loyalty] text-[--color-bg-base]',
            'transition-opacity duration-150',
            'hover:opacity-90 active:opacity-75',
            'focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-[--color-accent-loyalty] focus-visible:ring-offset-2',
            'focus-visible:ring-offset-[--color-bg-surface]',
            'disabled:pointer-events-none disabled:opacity-50',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label={`Redeem reward at ${card.merchantName}`}
        >
          {isRedeeming ? 'Redeeming…' : 'Redeem Reward'}
        </button>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Internal sub-component
// ---------------------------------------------------------------------------

interface MerchantLogoProps {
  src: string;
  alt: string;
}

/**
 * MerchantLogo — shows the merchant image or a fallback emoji if src is empty.
 *
 * The img element is intentionally not wrapped in next/image because merchant
 * logos come from untrusted external URLs and would require domain allow-listing
 * in next.config.ts. A plain img tag with explicit dimensions is sufficient here.
 */
function MerchantLogo({ src, alt }: MerchantLogoProps) {
  if (!src) {
    return (
      <span
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[--color-bg-elevated] text-2xl"
        aria-hidden="true"
      >
        🏪
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={48}
      height={48}
      className="h-12 w-12 flex-shrink-0 rounded-xl object-cover"
    />
  );
}
