import Link from "next/link";

/** Props for the SectionHeader component. */
interface SectionHeaderProps {
  /** Section title — rendered in display font. */
  title: string;
  /** Optional "See all" style action link. */
  action?: {
    label: string;
    href: string;
  };
  className?: string;
}

/**
 * Section divider with an optional right-aligned action link.
 *
 * Used above lists and groups of cards on dashboard pages.
 *
 * @example
 * <SectionHeader title="Your Cards" action={{ label: "See all", href: "/customer/cards" }} />
 */
export function SectionHeader({ title, action, className = "" }: SectionHeaderProps) {
  return (
    <div
      className={["flex items-center justify-between", className]
        .filter(Boolean)
        .join(" ")}
      style={{ marginBottom: 12 }}
    >
      <h2
        className="text-[15px] font-semibold text-(--color-text-primary)"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h2>

      {action && (
        <Link
          href={action.href}
          className="text-[13px] font-medium tap-target"
          style={{ color: "var(--color-brand-dark)" }}
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export default SectionHeader;
