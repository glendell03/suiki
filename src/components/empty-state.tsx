import Link from "next/link";
import type { ComponentType } from "react";

/** Props for the EmptyState component. */
interface EmptyStateProps {
  /** Lucide icon component — rendered at 48px in a brand-subtle circle. */
  icon: ComponentType<{ size?: number; style?: React.CSSProperties }>;
  /** Primary heading. */
  title: string;
  /** Supporting body text. */
  description: string;
  /** Optional CTA — renders as Link if href given, button otherwise. */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

/**
 * Full-section empty state with icon, heading, body text, and optional CTA.
 *
 * Used when lists return no results: no cards, no search results, etc.
 * Announces itself to screen readers via `aria-live="polite"`.
 *
 * @example
 * <EmptyState
 *   icon={ScanLine}
 *   title="No loyalty cards yet"
 *   description="Scan a QR code at a Suiki merchant to start collecting stamps."
 *   action={{ label: "Scan QR Code", href: "/customer/scan" }}
 * />
 */
export function EmptyState({ icon: Icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "flex flex-col items-center justify-center gap-4 py-16 px-6 text-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Icon inside brand circle */}
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 80,
          height: 80,
          background: "var(--color-brand-subtle)",
        }}
        aria-hidden="true"
      >
        <Icon size={48} style={{ color: "var(--color-brand)" }} />
      </div>

      {/* Text */}
      <div className="flex flex-col gap-2">
        <h3
          className="text-[17px] font-semibold text-(--color-text-primary)"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h3>
        <p
          className="text-[14px] text-(--color-text-secondary) leading-relaxed mx-auto"
          style={{ maxWidth: 260 }}
        >
          {description}
        </p>
      </div>

      {/* CTA */}
      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className="tap-target mt-1 rounded-full px-6 py-3 text-[14px] font-semibold text-white"
            style={{ background: "var(--color-brand)" }}
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="tap-target mt-1 rounded-full px-6 py-3 text-[14px] font-semibold text-white"
            style={{ background: "var(--color-brand)" }}
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}

export default EmptyState;
