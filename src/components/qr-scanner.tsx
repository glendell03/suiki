'use client';

import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { CameraOff } from 'lucide-react';

interface QrScannerProps {
  /**
   * When true: start scanning (acquire camera, process frames).
   * When false: stop scanning (release camera, keep WASM worker warm).
   */
  active: boolean;
  onScan: (data: string) => void;
  onError?: (err: Error) => void;
}

type PermState = 'checking' | 'granted' | 'denied' | 'error';

/**
 * QrScanner — camera QR scanner built on the `qr-scanner` package (Nimiq).
 *
 * Lifecycle design:
 *   - The QrScanner instance (and its WASM worker) is created ONCE on mount
 *     as soon as camera permission is confirmed. The WASM worker stays warm
 *     between scans — re-opening the scanner is near-instant.
 *   - `active` prop controls .start() / .stop(). Camera is acquired/released
 *     on each toggle, but WASM stays loaded.
 *   - .destroy() is only called on component unmount.
 *
 * Scan region:
 *   - calculateScanRegion constrains decoding to a centred 60% square.
 *   - Fewer pixels per frame → faster detection at typical scanning distances.
 */
export default function QrScannerComponent({ active, onScan, onError }: QrScannerProps) {
  const [permState, setPermState] = useState<PermState>('checking');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  // Stable ref keeps the scanner callback from capturing a stale onScan closure.
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  // Stable ref for onError — prevents the active effect from re-running when
  // the parent re-renders with a new inline onError function.
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // ── Check permission once on mount ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (cancelled) return;
        if (result.state === 'denied') setPermState('denied');
        else setPermState('granted');
      } catch {
        // Permissions API unsupported (some browsers) — proceed optimistically.
        if (!cancelled) setPermState('granted');
      }
    }

    void check();
    return () => { cancelled = true; };
  }, []);

  // ── Create scanner instance once when permission is confirmed ─────────────
  // WASM worker initialises here. Camera is NOT acquired — that happens
  // in the active effect below when the merchant taps Scan.
  useEffect(() => {
    if (permState !== 'granted') return;
    if (!videoRef.current) return;

    const scanner = new QrScanner(
      videoRef.current,
      (result) => onScanRef.current(result.data),
      {
        preferredCamera: 'environment',
        highlightScanRegion: true,
        highlightCodeOutline: true,
        // Constrain decode area to a centred 60% square.
        // Fewer pixels per frame = faster QR detection with no reliability loss
        // at the typical 15–40 cm scanning distance.
        calculateScanRegion: (video) => {
          const size = Math.round(
            Math.min(video.videoWidth, video.videoHeight) * 0.6,
          );
          return {
            x: Math.round((video.videoWidth - size) / 2),
            y: Math.round((video.videoHeight - size) / 2),
            width: size,
            height: size,
          };
        },
      },
    );

    scannerRef.current = scanner;

    return () => {
      scannerRef.current = null;
      scanner.destroy();
    };
  }, [permState]);

  // ── Start / stop based on active prop ────────────────────────────────────
  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    if (active) {
      scanner.start().catch((err: unknown) => {
        const msg = err instanceof Error
          ? err.message.toLowerCase()
          : String(err).toLowerCase();
        if (
          msg.includes('permission') ||
          msg.includes('notallowed') ||
          msg.includes('denied')
        ) {
          setPermState('denied');
        } else {
          const error = err instanceof Error ? err : new Error(String(err));
          setErrorMsg(error.message);
          setPermState('error');
          onErrorRef.current?.(error);
        }
      });
    } else {
      scanner.stop();
    }
  }, [active, permState]);

  // ── Permission denied ─────────────────────────────────────────────────────
  if (permState === 'denied') {
    return (
      <div className="flex flex-col items-center gap-5 py-8 px-4 text-center">
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 64, height: 64, background: 'rgba(239,68,68,0.1)' }}
          aria-hidden="true"
        >
          <CameraOff size={28} style={{ color: 'var(--color-error)' }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <p
            className="text-(--color-text-primary)"
            style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)' }}
          >
            Camera blocked
          </p>
          <p className="text-(--color-text-secondary)" style={{ fontSize: 14, lineHeight: 1.5 }}>
            Allow camera access in your browser settings, then try again.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center rounded-full border border-(--color-border) bg-(--color-surface) px-6 py-2.5 text-[14px] font-semibold text-(--color-text-primary) tap-target transition-opacity hover:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Camera error (non-permission) ─────────────────────────────────────────
  if (permState === 'error') {
    return (
      <div className="flex flex-col items-center gap-5 py-8 px-4 text-center">
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 64, height: 64, background: 'rgba(239,68,68,0.1)' }}
          aria-hidden="true"
        >
          <CameraOff size={28} style={{ color: 'var(--color-error)' }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <p
            className="text-(--color-text-primary)"
            style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)' }}
          >
            Camera error
          </p>
          {errorMsg && (
            <p className="text-(--color-text-secondary)" style={{ fontSize: 13, lineHeight: 1.5 }}>
              {errorMsg}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setErrorMsg(null); setPermState('checking'); }}
          className="inline-flex items-center justify-center rounded-full border border-(--color-border) bg-(--color-surface) px-6 py-2.5 text-[14px] font-semibold text-(--color-text-primary) tap-target transition-opacity hover:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Video element — always in DOM once permission is confirmed ────────────
  // qr-scanner attaches to this ref. Visibility is controlled by the parent
  // wrapping container (display: none when inactive) — not by this component.
  return (
    <div className="rounded-2xl overflow-hidden w-full bg-black" style={{ minHeight: 260 }}>
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        style={{ minHeight: 260 }}
        muted
        playsInline
      />
    </div>
  );
}
