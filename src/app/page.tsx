import Link from 'next/link';

/**
 * Landing page — Server Component (no 'use client' directive).
 *
 * Presents the two primary entry points (Merchant, Customer) with a short
 * value-prop list. Full-screen dark layout, mobile-first from 375 px up.
 */
export default function Home() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-10 px-5 py-12 bg-[--color-bg-base]">

      {/* Hero */}
      <section className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-[--color-text-primary]">
          Suiki
        </h1>
        <p className="text-lg text-[--color-text-secondary]">
          Loyalty on SUI
        </p>
      </section>

      {/* Primary CTAs */}
      <nav
        aria-label="Primary entry points"
        className="flex flex-col gap-4 w-full max-w-xs"
      >
        <Link
          href="/merchant"
          className={[
            'flex items-center justify-center rounded-xl px-6 py-4',
            'bg-[--color-primary] text-white font-semibold text-base',
            'transition-opacity duration-150 hover:opacity-90 active:opacity-75',
            'focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-[--color-primary] focus-visible:ring-offset-2',
            'focus-visible:ring-offset-[--color-bg-base]',
          ].join(' ')}
        >
          I&apos;m a Merchant →
        </Link>

        <Link
          href="/customer"
          className={[
            'flex items-center justify-center rounded-xl px-6 py-4',
            'border border-[--color-border] bg-[--color-bg-surface]',
            'text-[--color-text-primary] font-semibold text-base',
            'transition-colors duration-150 hover:bg-[--color-bg-elevated] active:opacity-75',
            'focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-[--color-primary] focus-visible:ring-offset-2',
            'focus-visible:ring-offset-[--color-bg-base]',
          ].join(' ')}
        >
          I&apos;m a Customer →
        </Link>
      </nav>

      {/* Value props */}
      <section aria-label="Why Suiki" className="w-full max-w-xs">
        <ul className="flex flex-col gap-3">
          {[
            'No punch cards to lose',
            'Stamps are NFTs you own forever',
            'Zero transaction fees for customers',
          ].map((prop) => (
            <li
              key={prop}
              className="flex items-start gap-2 text-sm text-[--color-text-secondary]"
            >
              <span className="text-[--color-success] font-bold" aria-hidden="true">
                ✓
              </span>
              {prop}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
