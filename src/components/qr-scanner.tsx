'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '@/components/ui/button';

interface QrScannerProps {
  /** Called with the decoded string when a QR code is successfully scanned. */
  onScan: (data: string) => void;
  /** Optional callback for non-fatal scan errors (per-frame decode failures). */
  onError?: (err: Error) => void;
}

/** Internal states for the scanner lifecycle. */
type ScannerState = 'loading' | 'scanning' | 'permission-denied' | 'error';

/**
 * QrScanner — camera-based QR code scanner component.
 *
 * Lifecycle:
 *   loading → scanning (camera permission granted)
 *   loading → permission-denied (camera blocked)
 *   loading / scanning → error (unexpected failure)
 *
 * The html5-qrcode scanner is mounted on the container div, auto-started,
 * and cleaned up on unmount. The retry button reloads the page so the
 * browser re-requests camera permission.
 */
export default function QrScanner({ onScan, onError }: QrScannerProps) {
  const [state, setState] = useState<ScannerState>('loading');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  // Track current state in a ref so the setTimeout closure reads the live value,
  // not the stale captured value from when the effect ran.
  const stateRef = useRef<ScannerState>('loading');

  // useId produces a stable per-instance id, ensuring two simultaneous QrScanner
  // mounts never target the same DOM element (html5-qrcode requires a unique id).
  const rawId = useId();
  // Replace colons from React's internal id format with hyphens for a valid DOM id.
  const containerId = `qr-scanner-${rawId.replace(/:/g, '')}`;

  useEffect(() => {
    let mounted = true;
    stateRef.current = 'loading';

    const scanner = new Html5QrcodeScanner(
      containerId,
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose */ false,
    );

    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        if (!mounted) return;
        onScan(decodedText);
      },
      (errorMessage) => {
        if (!mounted) return;

        // Permission errors are surfaced as a specific string prefix by the library.
        if (
          typeof errorMessage === 'string' &&
          errorMessage.toLowerCase().includes('permission')
        ) {
          stateRef.current = 'permission-denied';
          setState('permission-denied');
          return;
        }

        // Per-frame decode failures are normal noise — only forward to caller.
        onError?.(new Error(errorMessage));
      },
    );

    // After render, the library starts the camera. Transition to scanning only if
    // state is still 'loading' — checked via ref to avoid stale closure.
    const transitionTimer = setTimeout(() => {
      if (mounted && stateRef.current === 'loading') {
        stateRef.current = 'scanning';
        setState('scanning');
      }
    }, 800);

    return () => {
      mounted = false;
      clearTimeout(transitionTimer);

      // Clean up: stop the scanner and remove the DOM elements it created.
      scannerRef.current
        ?.clear()
        .catch(() => {
          // Ignore cleanup errors — the component is already unmounting.
        });
      scannerRef.current = null;
    };
  // onScan and onError are intentionally excluded: they change reference on
  // every render but we only want the scanner mounted once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'permission-denied') {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-[--color-border] bg-[--color-bg-surface] p-8 text-center">
        {/* Camera blocked icon */}
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[--color-error]/20"
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7 text-[--color-error]"
          >
            <path d="M23 7 16 12 23 17V7Z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        </div>

        <div className="flex flex-col gap-1">
          <p className="font-semibold text-[--color-text-primary]">
            Camera access denied
          </p>
          <p className="text-sm text-[--color-text-secondary]">
            Allow camera access in your browser settings, then try again.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {state === 'loading' && (
        <p className="text-sm text-[--color-text-muted]">
          Initializing camera…
        </p>
      )}

      {/* The pulsing border signals active scanning to the user. */}
      <div
        className={[
          'rounded-2xl overflow-hidden w-full',
          state === 'scanning'
            ? 'ring-2 ring-[--color-primary] animate-pulse'
            : 'ring-1 ring-[--color-border]',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* html5-qrcode mounts its own DOM into this container. */}
        <div id={containerId} />
      </div>
    </div>
  );
}
