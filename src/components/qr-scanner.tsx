'use client';

import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Camera, CameraOff } from 'lucide-react';


interface QrScannerProps {
  onScan: (data: string) => void;
  onError?: (err: Error) => void;
}

type ScannerState =
  | 'checking'          // querying navigator.permissions
  | 'prompt'            // show our own "allow camera" screen
  | 'requesting'        // browser permission dialog is open
  | 'scanning'          // camera feed active
  | 'permission-denied'
  | 'error'

/**
 * QrScanner — camera QR scanner built on the `qr-scanner` package (Nimiq).
 *
 * Unlike html5-qrcode, qr-scanner works directly with a <video> ref —
 * no container ID, no DOM ID lookups, no StrictMode lifecycle issues.
 *
 * Flow:
 *   checking → granted        → scanning        (camera starts immediately)
 *   checking → denied         → permission-denied
 *   checking → prompt/unknown → our prompt screen → scanning or permission-denied
 */
export default function QrScannerComponent({ onScan, onError }: QrScannerProps) {
  const [state, setState] = useState<ScannerState>('checking');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  // ── Check permission on mount ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (cancelled) return;
        if (result.state === 'granted') setState('scanning');
        else if (result.state === 'denied') setState('permission-denied');
        else setState('prompt');
      } catch {
        // Permissions API unsupported — fall through; the scanner will surface
        // a NotAllowedError itself if permission is actually denied.
        if (!cancelled) setState('scanning');
      }
    }

    void check();
    return () => { cancelled = true; };
  }, []);

  // ── Attach QrScanner to the <video> element when scanning ─────────────────
  useEffect(() => {
    if (state !== 'scanning') return;
    if (!videoRef.current) return;

    const scanner = new QrScanner(
      videoRef.current,
      (result) => onScan(result.data),
      {
        preferredCamera: 'environment',
        highlightScanRegion: true,
        highlightCodeOutline: true,
      },
    );

    scannerRef.current = scanner;

    scanner.start().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        if (msg.includes('permission') || msg.includes('notallowed') || msg.includes('denied')) {
          setState('permission-denied');
        } else {
          const error = err instanceof Error ? err : new Error(String(err));
          setErrorMsg(error.message);
          setState('error');
          onError?.(error);
        }
      });

    return () => {
      scannerRef.current = null;
      // destroy() stops the camera stream and removes all injected DOM nodes —
      // safe to call even if start() hasn't resolved yet.
      scanner.destroy();
    };

    // onScan/onError intentionally omitted — scanner is recreated when state
    // transitions to 'scanning', which is the correct lifecycle boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // ── Request permission (user clicked "Allow Camera") ──────────────────────
  async function requestPermission() {
    setState('requesting');
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      setState('scanning');
    } catch {
      setState('permission-denied');
    }
  }

  // ── Permission prompt / requesting ────────────────────────────────────────
  if (state === 'checking' || state === 'prompt' || state === 'requesting') {
    const isRequesting = state === 'requesting';

    return (
      <div className="flex flex-col items-center gap-6 py-8 px-4 text-center">
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 72, height: 72, background: 'var(--color-brand-subtle)' }}
          aria-hidden="true"
        >
          <Camera size={32} aria-hidden={true} style={{ color: 'var(--color-brand)' }} />
        </div>

        <div className="flex flex-col gap-2">
          <p
            className="text-(--color-text-primary)"
            style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-display)' }}
          >
            Camera access needed
          </p>
          <p className="text-(--color-text-secondary)" style={{ fontSize: 14, lineHeight: 1.5 }}>
            We need your camera to scan loyalty QR codes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void requestPermission()}
          disabled={isRequesting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold text-white tap-target disabled:opacity-60 transition-opacity"
          style={{ background: 'var(--color-brand)' }}
        >
          {isRequesting ? (
            <>
              <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Waiting for permission…
            </>
          ) : (
            <><Camera size={16} aria-hidden={true} /> Allow Camera</>
          )}
        </button>

        <p className="text-(--color-text-muted)" style={{ fontSize: 12, lineHeight: 1.5 }}>
          Your camera is only used for scanning QR codes.
        </p>
      </div>
    );
  }

  // ── Permission denied ─────────────────────────────────────────────────────
  if (state === 'permission-denied') {
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

  // ── Non-permission scanner error ───────────────────────────────────────────
  if (state === 'error') {
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
          <p className="text-(--color-text-primary)" style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
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
          onClick={() => { setErrorMsg(null); setState('checking'); }}
          className="inline-flex items-center justify-center rounded-full border border-(--color-border) bg-(--color-surface) px-6 py-2.5 text-[14px] font-semibold text-(--color-text-primary) tap-target transition-opacity hover:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Active scanner — video element is always mounted in this branch ────────
  // qr-scanner attaches to the ref and manages the MediaStream directly.
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
