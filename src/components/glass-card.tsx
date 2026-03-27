import type { MouseEventHandler, ReactNode } from "react";

/** Padding size variants for GlassCard. */
type GlassPadding = "none" | "sm" | "md" | "lg";

/** HTML element to render as the card root. */
type GlassElement = "div" | "button" | "article";

/** Props for the GlassCard component. */
interface GlassCardProps {
  children: ReactNode;
  className?: string;
  /** Click handler — also adds press-scale animation and ARIA role when provided. */
  onClick?: MouseEventHandler;
  /** Which semantic HTML element to render as. Defaults to "div". */
  as?: GlassElement;
  /** Internal padding. Defaults to "md". */
  padding?: GlassPadding;
}

const PADDING_CLASSES: Record<GlassPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

/**
 * Frosted-glass surface card using the `.glass-card` CSS class defined in globals.css.
 *
 * Renders an interactive, pressable variant when `onClick` is provided,
 * adding the `.tap-target` press-scale animation and the appropriate ARIA role.
 *
 * @example
 * <GlassCard padding="lg" onClick={handlePress}>
 *   <p>Content</p>
 * </GlassCard>
 */
export function GlassCard({
  children,
  className = "",
  onClick,
  as: Tag = "div",
  padding = "md",
}: GlassCardProps) {
  const isInteractive = Boolean(onClick);

  return (
    <Tag
      onClick={onClick}
      role={isInteractive && Tag === "div" ? "button" : undefined}
      tabIndex={isInteractive && Tag === "div" ? 0 : undefined}
      className={[
        "glass-card",
        PADDING_CLASSES[padding],
        isInteractive ? "tap-target cursor-pointer" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}

export default GlassCard;
