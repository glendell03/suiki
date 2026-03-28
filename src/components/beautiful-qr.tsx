"use client";

import { useEffect, useRef, useState } from "react";

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
  /**
   * QR error correction level. Higher = more robust but denser.
   * "Q" (25%) recommended for display use. Defaults to "Q".
   */
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  className?: string;
}

/**
 * Renders a styled canvas QR code using the `qr-code-styling` package.
 *
 * Uses rounded dots + extra-rounded corner squares for a modern look.
 * Dynamically imports the library to avoid SSR issues.
 *
 * @example
 * <BeautifulQR value="0xabc123" label="Scan to earn stamps" size={220} />
 */
export function BeautifulQR({
  value,
  size = 220,
  label,
  foregroundColor = "#000000",
  backgroundColor = "#ffffff",
  errorCorrectionLevel = "Q",
  className = "",
}: BeautifulQRProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !value) return;

    setIsReady(false);
    setError(null);

    import("qr-code-styling")
      .then(({ default: QRCodeStyling }) => {
        // Clear previous render
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }

        const qr = new QRCodeStyling({
          width: size,
          height: size,
          type: "svg",
          data: value,
          margin: 0,
          qrOptions: {
            typeNumber: 0,
            mode: "Byte",
            errorCorrectionLevel,
          },
          dotsOptions: {
            type: "dots",
            color: foregroundColor,
            roundSize: true,
          },
          backgroundOptions: {
            color: backgroundColor,
          },
          cornersSquareOptions: {
            type: "extra-rounded",
            color: foregroundColor,
          },
          cornersDotOptions: {
            type: "dot",
            color: foregroundColor,
          },
        });

        qr.append(container);
        setIsReady(true);
      })
      .catch(() => setError("QR code could not be generated."));
  }, [value, size, foregroundColor, backgroundColor, errorCorrectionLevel]);

  return (
    <div
      className={["flex flex-col items-center gap-2", className]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Skeleton shown while the canvas is being generated */}
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

      {/* Container where qr-code-styling appends the canvas element */}
      <div
        ref={containerRef}
        role="img"
        aria-label={`QR code: ${label ?? value}`}
        style={{ width: size, height: size }}
        className={[
          "overflow-hidden rounded-xl [&>svg]:w-full [&>svg]:h-full [&>svg]:block",
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
