import Link from "next/link";
import { Store, CreditCard, ArrowRight } from "lucide-react";

/**
 * Suiki V2 landing page — Server Component.
 * SUI Water design: solid sky-blue hero with white lower section and two CTA cards.
 */
export default function Home() {
  return (
    <main className="min-h-dvh flex flex-col max-w-[430px] mx-auto">
      {/* Hero — solid brand background */}
      <section className="min-h-[42vh] relative flex flex-col items-center justify-center px-6 py-12 gap-3 bg-(--color-brand)">
        {/* 水 watermark */}
        <span
          aria-hidden="true"
          className="absolute top-4 right-4 text-[120px] font-extrabold leading-none text-white/10 pointer-events-none select-none"
          style={{ fontFamily: "var(--font-display-stack)" }}
        >
          水
        </span>

        {/* Logo + tagline */}
        <h1
          className="flex items-center gap-2 text-4xl font-extrabold text-white"
          style={{ fontFamily: "var(--font-display-stack)" }}
        >
          <span
            aria-hidden="true"
            className="w-2 h-2 rounded-full bg-white inline-block"
          />
          Suiki
        </h1>
        <p className="text-[15px] font-normal text-white/75">
          Loyalty on SUI blockchain
        </p>
      </section>

      {/* Lower section — white */}
      <section className="flex-1 bg-(--color-surface) px-5 py-8 flex flex-col gap-8">
        {/* CTA cards */}
        <nav
          aria-label="Primary entry points"
          className="grid grid-cols-2 gap-4"
        >
          <Link
            href="/merchant"
            className="flex flex-col gap-3 rounded-(--radius-xl) border border-(--color-border) bg-(--color-surface) p-5 shadow-(--shadow-card) active:scale-[0.97] transition-transform duration-(--duration-micro)"
          >
            <Store size={24} className="text-(--color-brand)" />
            <div className="flex flex-col gap-0.5">
              <span
                className="text-[15px] font-bold text-(--color-text-primary)"
                style={{ fontFamily: "var(--font-display-stack)" }}
              >
                Merchant
              </span>
              <span className="text-[13px] text-(--color-text-secondary)">
                Manage programs
              </span>
            </div>
            <ArrowRight size={16} className="text-(--color-text-muted) mt-auto" />
          </Link>

          <Link
            href="/customer"
            className="flex flex-col gap-3 rounded-(--radius-xl) border border-(--color-border) bg-(--color-surface) p-5 shadow-(--shadow-card) active:scale-[0.97] transition-transform duration-(--duration-micro)"
          >
            <CreditCard size={24} className="text-(--color-loyalty)" />
            <div className="flex flex-col gap-0.5">
              <span
                className="text-[15px] font-bold text-(--color-text-primary)"
                style={{ fontFamily: "var(--font-display-stack)" }}
              >
                Customer
              </span>
              <span className="text-[13px] text-(--color-text-secondary)">
                Earn &amp; redeem stamps
              </span>
            </div>
            <ArrowRight size={16} className="text-(--color-text-muted) mt-auto" />
          </Link>
        </nav>

        {/* Why Suiki? */}
        <section aria-label="Why Suiki">
          <h2
            className="text-[15px] font-bold text-(--color-text-primary) mb-4"
            style={{ fontFamily: "var(--font-display-stack)" }}
          >
            Why Suiki?
          </h2>
          <ul className="flex flex-col gap-3">
            {[
              "No app download needed",
              "Stamps live on the blockchain",
              "Works at any Suiki merchant",
            ].map((point) => (
              <li
                key={point}
                className="flex items-center gap-3 text-sm text-(--color-text-secondary)"
              >
                <span
                  aria-hidden="true"
                  className="w-1 h-1 shrink-0 rounded-[1px] bg-(--color-brand)"
                />
                {point}
              </li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  );
}
