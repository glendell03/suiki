"use client";

import type { ReactNode } from "react";

/** Props for the PageShell layout container. */
interface PageShellProps {
  children: ReactNode;
  /** When true (default), adds `.pb-nav` bottom padding to clear the bottom navigation bar. */
  hasBottomNav?: boolean;
  /** When true (default), adds `.pt-safe` top padding to respect safe-area insets. */
  hasTopPadding?: boolean;
  className?: string;
}

/**
 * Root layout shell for all customer and merchant pages.
 *
 * Provides the full-height gradient background, max-width centering for
 * the 430px mobile viewport, and a subtle phone-frame outline on desktop to
 * communicate the PWA is designed for mobile screens.
 *
 * @example
 * <PageShell>
 *   <YourPageContent />
 * </PageShell>
 */
export function PageShell({
  children,
  hasBottomNav = true,
  hasTopPadding = true,
  className = "",
}: PageShellProps) {
  return (
    <div className="min-h-dvh page-gradient">
      {/* Phone frame hint for desktop visitors */}
      <div
        className={[
          "relative mx-auto max-w-[430px] min-h-dvh flex flex-col overflow-x-hidden",
          // On md+ screens, draw a subtle inset ring to convey the mobile frame
          "md:ring-1 md:ring-(--color-border) md:shadow-2xl",
          hasTopPadding ? "pt-safe" : "",
          hasBottomNav ? "pb-nav" : "pb-safe",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

export default PageShell;
