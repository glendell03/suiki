"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

/** Props for the BottomSheet component. */
interface BottomSheetProps {
  /** Whether the sheet is visible. */
  open: boolean;
  /** Called when the user taps the backdrop or swipes down. */
  onClose: () => void;
  /** Optional title — centered, display font. */
  title?: string;
  children: ReactNode;
}

/**
 * Slide-up modal sheet anchored to the bottom of the viewport.
 *
 * Renders into a portal so it floats above all page content.
 * Backdrop tap closes the sheet. Enter/exit via Framer Motion spring.
 *
 * @example
 * <BottomSheet open={isOpen} onClose={() => setOpen(false)} title="Share QR">
 *   <p>Sheet content</p>
 * </BottomSheet>
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  // Avoid SSR mismatch — only mount portal after hydration
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-[60]"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title ?? "Bottom sheet"}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%", transition: { duration: 0.25, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[61]
                       bg-(--color-surface) flex flex-col"
            style={{
              borderRadius: "24px 24px 0 0",
              boxShadow: "var(--shadow-modal)",
              paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
              maxHeight: "90dvh",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1" aria-hidden="true">
              <div
                className="rounded-full"
                style={{
                  width: 32,
                  height: 4,
                  background: "var(--color-border)",
                }}
              />
            </div>

            {/* Title */}
            {title && (
              <div className="px-4 pb-3 text-center border-b border-(--color-border)">
                <h2
                  className="text-[17px] font-bold text-(--color-text-primary)"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {title}
                </h2>
              </div>
            )}

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 pt-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default BottomSheet;
