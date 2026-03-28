'use client';

import { BeautifulQR } from './beautiful-qr';

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
 * Delegates to BeautifulQR for consistent styling across the app.
 */
export default function QrCode({ data, size = 200, label }: QrCodeProps) {
  return <BeautifulQR value={data} size={size} {...(label !== undefined ? { label } : {})} />;
}
