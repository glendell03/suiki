import { Button } from "@/components/ui/button";

/**
 * Landing page — Server Component (no "use client" directive).
 * Presents the two primary entry points: Merchant dashboard and Customer wallet.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 bg-slate-900 text-white">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Suiki</h1>
        <p className="text-lg text-slate-400">
          Loyalty stamp cards on the SUI blockchain
        </p>
      </header>

      <nav
        aria-label="Primary entry points"
        className="flex flex-col sm:flex-row gap-4 w-full max-w-sm"
      >
        <Button
          variant="primary"
          aria-label="Go to merchant dashboard"
          className="flex-1"
        >
          Merchant
        </Button>

        <Button
          variant="secondary"
          aria-label="Go to customer wallet"
          className="flex-1"
        >
          Customer
        </Button>
      </nav>
    </main>
  );
}
