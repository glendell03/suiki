"use client";

import type { ReactNode } from "react";

/** Props for the PageHeader fixed top navigation bar. */
interface PageHeaderProps {
  /** Page title — centered, displayed in display font. */
  title: string;
  /** Optional subtitle below the title. */
  subtitle?: string;
  /** Left slot — typically a back button. 40×40 tap target. */
  leftAction?: ReactNode;
  /** Right slot — settings, share, etc. 40×40 tap target. */
  rightAction?: ReactNode;
  /** Render with transparent background — for pages where header overlaps hero imagery. */
  transparent?: boolean;
}

/**
 * Fixed 56px page header (plus safe-area-inset-top).
 *
 * Title is centered between optional left/right action slots (each 40×40px).
 * Use with `hasHeader` on PageShell so content is offset below this header.
 *
 * @example
 * <PageHeader
 *   title="My Cards"
 *   leftAction={<BackButton />}
 * />
 */
export function PageHeader({
  title,
  subtitle,
  leftAction,
  rightAction,
  transparent = false,
}: PageHeaderProps) {
  return (
    <header
      className={[
        "fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40",
        "flex items-end justify-between px-3",
        transparent
          ? "border-transparent bg-transparent"
          : "border-b border-(--color-border) bg-(--color-surface)",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        height: "calc(56px + env(safe-area-inset-top))",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "8px",
        boxShadow: "none",
      }}
    >
      {/* Left action — 40×40 touch target */}
      <div
        className="flex items-center justify-start shrink-0"
        style={{ width: 40, minWidth: 40 }}
      >
        {leftAction ?? null}
      </div>

      {/* Center title block */}
      <div className="flex-1 flex flex-col items-center text-center min-w-0 px-2">
        <h1
          className="text-[17px] font-bold text-(--color-text-primary) truncate w-full text-center leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] text-(--color-text-secondary) truncate w-full text-center leading-snug mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {/* Right action — 40×40 touch target */}
      <div
        className="flex items-center justify-end shrink-0"
        style={{ width: 40, minWidth: 40 }}
      >
        {rightAction ?? null}
      </div>
    </header>
  );
}

export default PageHeader;
