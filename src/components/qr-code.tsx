'use client';

import { QRCodeSVG } from 'qrcode.react';

interface QrCodeProps {
  /** The data string to encode into the QR code. */
  data: string;
  /** Size in pixels (width and height). Defaults to 200. */
  size?: number;
  /** Optional label shown below the QR code in muted text. */
  label?: string;
}

/**
 * QrCode — renders a centered QR code with an optional text label.
 *
 * Uses dark-on-white rendering for maximum scanner contrast. Wrap in a
 * white-background container (e.g. `bg-white p-3 rounded-xl`) for best results.
 */
export default function QrCode({ data, size = 200, label }: QrCodeProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <QRCodeSVG
        value={data}
        size={size}
        fgColor="#0f172a"
        bgColor="#ffffff"
        aria-label={label ?? 'QR code'}
      />

      {label && (
        <p className="text-sm text-(--color-text-muted) text-center">
          {label}
        </p>
      )}
    </div>
  );
}
