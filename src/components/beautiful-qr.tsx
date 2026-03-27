"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeStyling } from "beautiful-qr-code";

/** Props for the BeautifulQR component. */
interface BeautifulQRProps {
  /** The data string to encode in the QR code (e.g. wallet address or URL). */
  value: string;
  /** Canvas size in pixels. Defaults to 220. */
  size?: number;
  /** Optional text label rendered below the QR code. */
  label?: string;
  /** QR dot color. Raw hex is OK here -- this is QR rendering data, not a design token. */
  foregroundColor?: string;
  /** QR background color. Raw hex is OK here -- this is QR rendering data, not a design token. */
  backgroundColor?: string;
  className?: string;
}

/** Removes all child nodes from a DOM element without using innerHTML. */
function clearElement(el: HTMLElement): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Renders a styled SVG QR code using the `beautiful-qr-code` package.
 *
 * The package exposes a class-based imperative API that appends an SVG into a
 * DOM container. We use a ref + useEffect here intentionally — this is a
 * legitimate DOM-mutation side effect (not data fetching), which is the
 * correct use of useEffect in React 19.
 *
 * Colors: black dots (#111111) on white (#ffffff). Falls back to a skeleton
 * placeholder while the SVG is rendering.
 *
 * @example
 * <BeautifulQR value="0xabc123" label="Scan to earn stamps" size={220} />
 */
export function BeautifulQR({
  value,
  size = 220,
  label,
  foregroundColor: fgColor,
  backgroundColor: bgColor,
  className = "",
}: BeautifulQRProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !value) return;

    // Clear previous render when value or size changes
    clearElement(container);
    setIsReady(false);
    setError(null);

    const qr = new QRCodeStyling({
      data: value,
      type: "svg",
      // typeNumber 0 lets the library pick the smallest valid type automatically
      typeNumber: 0,
      errorCorrectionLevel: "M",
      mode: "Byte",
      radius: 0.6,
      padding: 0,
      foregroundColor: fgColor ?? "#111111",
      backgroundColor: bgColor ?? "#ffffff",
      hasLogo: false,
    });

    qr.append(container)
      .then(() => setIsReady(true))
      .catch(() => setError("QR code could not be generated."));
  }, [value, size, fgColor, bgColor]);

  return (
    <div
      className={["flex flex-col items-center gap-2", className]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Skeleton shown while the SVG is being generated */}
      {!isReady && !error && (
        <div
          aria-hidden="true"
          style={{ width: size, height: size }}
          className="animate-pulse rounded-xl bg-(--color-bg-elevated)"
        />
      )}

      {error && (
        <div
          role="alert"
          style={{ width: size, height: size }}
          className="flex items-center justify-center rounded-xl bg-(--color-bg-elevated) text-xs text-(--color-text-secondary)"
        >
          {error}
        </div>
      )}

      {/* Container where QRCodeStyling appends the SVG element */}
      <div
        ref={containerRef}
        role="img"
        aria-label={`QR code: ${label ?? value}`}
        style={{ width: size, height: size }}
        className={[
          "overflow-hidden rounded-xl",
          isReady ? "block" : "hidden",
        ].join(" ")}
      />

      {label && (
        <p className="text-sm text-(--color-text-secondary)">{label}</p>
      )}
    </div>
  );
}

export default BeautifulQR;
