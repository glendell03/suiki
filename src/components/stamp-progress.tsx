'use client';

interface StampProgressProps {
  /** Number of stamps the customer currently holds on this card. */
  current: number;
  /** Total stamps required before the customer can redeem. */
  required: number;
}

/**
 * StampProgress — visual representation of stamp card progress.
 *
 * For programs with 10 or fewer required stamps it renders a dot grid:
 *   ● filled  — text-[--color-accent-loyalty]   (gold)
 *   ○ empty   — text-[--color-accent-loyalty-muted]
 *
 * For programs requiring more than 10 stamps the dots are omitted and only
 * the numeric text is shown (grid would be too small to be useful on mobile).
 */
export function StampProgress({ current, required }: StampProgressProps) {
  const useDots = required <= 10;

  return (
    <div
      className="flex flex-col items-center gap-2"
      aria-label={`${current} of ${required} stamps collected`}
      role="status"
    >
      {useDots && (
        <div
          className="flex flex-wrap justify-center gap-2"
          aria-hidden="true"
        >
          {Array.from({ length: required }, (_, index) => {
            const isFilled = index < current;

            return (
              <span
                key={index}
                className={[
                  'text-2xl leading-none select-none',
                  isFilled
                    ? 'text-[--color-accent-loyalty]'
                    : 'text-[--color-accent-loyalty-muted]',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {isFilled ? '●' : '○'}
              </span>
            );
          })}
        </div>
      )}

      <p className="text-sm font-medium text-[--color-text-secondary]">
        {current} / {required} stamps
      </p>
    </div>
  );
}
