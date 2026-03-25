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
 * Uses white-on-transparent rendering so the code is legible over the
 * Suiki dark background without needing a white card behind it.
 * The fgColor matches --color-text-primary from globals.css.
 */
export default function QrCode({ data, size = 200, label }: QrCodeProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <QRCodeSVG
        value={data}
        size={size}
        fgColor="#f1f5f9"
        bgColor="transparent"
        aria-label={label ?? 'QR code'}
      />

      {label && (
        <p className="text-sm text-[--color-text-muted] text-center">
          {label}
        </p>
      )}
    </div>
  );
}
