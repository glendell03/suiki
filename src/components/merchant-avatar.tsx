"use client";

import { useState } from "react";

/** Props for the MerchantAvatar component. */
interface MerchantAvatarProps {
  /** URL of the merchant's logo image. Falls back to initials if absent or fails to load. */
  logoUrl?: string;
  /** Merchant display name — used to derive initials fallback. */
  name: string;
  /** Pixel size for the avatar square. @default 40 */
  size?: 32 | 40 | 48 | 56 | 64;
  /** Additional CSS classes on the wrapper. */
  className?: string;
}

/** Maps avatar size → initials font size in px. */
const FONT_SIZE: Record<number, number> = {
  32: 12,
  40: 14,
  48: 16,
  56: 18,
  64: 20,
};

/**
 * Returns up to two initials from a merchant name.
 * "Coffee Bean" → "CB", "Sushi" → "S"
 */
function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Circular merchant logo with initials fallback.
 *
 * Renders a raw `<img>` (not next/image) since merchant logo URLs are
 * external and not whitelisted in next.config. On load failure or when no
 * URL is provided, shows styled initials derived from `name`.
 *
 * @example
 * <MerchantAvatar logoUrl={program.logoUrl} name="Coffee Bean" size={48} />
 */
export function MerchantAvatar({
  logoUrl,
  name,
  size = 40,
  className = "",
}: MerchantAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = Boolean(logoUrl) && !imgError;
  const fontSize = FONT_SIZE[size] ?? 14;
  const initials = getInitials(name);

  return (
    <div
      aria-hidden="true"
      className={[
        "shrink-0 overflow-hidden flex items-center justify-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        width: size,
        height: size,
        borderRadius: "var(--radius-full)",
        background: "var(--color-brand-subtle)",
      }}
    >
      {showImage ? (
        <img
          src={logoUrl}
          alt={name}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className="select-none font-bold leading-none"
          style={{
            fontSize,
            color: "var(--color-brand-dark)",
            fontFamily: "var(--font-display)",
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}

export default MerchantAvatar;
