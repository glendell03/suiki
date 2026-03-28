"use client";

/**
 * /stamp-showcase — Interactive stamp design picker
 *
 * Shows 6 distinct stamp styles. Click any empty slot to earn a stamp
 * and see the animation. Pick the style you love.
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ---------------------------------------------------------------------------
// Stamp SVG designs — 6 distinct variants
// ---------------------------------------------------------------------------

interface StampProps {
  earned: boolean;
  size?: number;
}

/** V1 — Classic Passport: double ring + radial ticks + arc text */
function V1({ earned, size = 56 }: StampProps) {
  const C = size / 2;
  const R1 = size * 0.455; // outer ring
  const R2 = size * 0.32;  // inner fill
  const TICKS = 12;
  const ink = earned ? "#1e3a5f" : "#d1d5db";
  const fill = earned ? "#1e3a5f" : "transparent";
  const textFill = earned ? "#ffffff" : "transparent";

  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const a = ((i * 360) / TICKS - 90) * (Math.PI / 180);
    return {
      x1: C + Math.cos(a) * (R2 + 2),
      y1: C + Math.sin(a) * (R2 + 2),
      x2: C + Math.cos(a) * (R1 - 2),
      y2: C + Math.sin(a) * (R1 - 2),
    };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {/* Outer ring */}
      <circle cx={C} cy={C} r={R1} fill="none" stroke={ink} strokeWidth={1.8} />
      {/* Inner fill */}
      <circle cx={C} cy={C} r={R2} fill={fill} stroke={ink} strokeWidth={1.2} />
      {/* Radial ticks */}
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={ink} strokeWidth={1} />
      ))}
      {/* Check mark when earned */}
      {earned && (
        <text x={C} y={C + 4} textAnchor="middle" fontSize={size * 0.28} fill={textFill} fontFamily="serif" fontWeight="bold">
          ✓
        </text>
      )}
    </svg>
  );
}

/** V2 — Wax Seal: scalloped gear edge + monogram */
function V2({ earned, size = 56 }: StampProps) {
  const C = size / 2;
  const R = size * 0.42;
  const BUMPS = 16;
  const bumpH = size * 0.055;
  const ink = earned ? "#7c3aed" : "#d1d5db";
  const fill = earned ? "#7c3aed" : "transparent";

  // Build scalloped circle path
  const points: string[] = [];
  for (let i = 0; i <= BUMPS * 2; i++) {
    const a = ((i * 180) / BUMPS - 90) * (Math.PI / 180);
    const r = i % 2 === 0 ? R : R - bumpH;
    points.push(`${C + Math.cos(a) * r},${C + Math.sin(a) * r}`);
  }
  const d = `M ${points.join(" L ")} Z`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <path d={d} fill={fill} stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
      {/* Inner circle */}
      <circle cx={C} cy={C} r={R * 0.58} fill="none" stroke={ink} strokeWidth={1} />
      {/* Monogram / check */}
      <text
        x={C}
        y={C + size * 0.1}
        textAnchor="middle"
        fontSize={size * (earned ? 0.28 : 0.32)}
        fill={earned ? "#ffffff" : ink}
        fontFamily="serif"
        fontWeight="bold"
      >
        {earned ? "✓" : "S"}
      </text>
    </svg>
  );
}

/** V3 — Rough Ink: rubber-stamp feel with turbulence filter + bold ring */
function V3({ earned, size = 56 }: StampProps) {
  const C = size / 2;
  const R = size * 0.43;
  const ink = earned ? "#92400e" : "#d1d5db";
  const fill = earned ? "#b45309" : "transparent";
  const id = `turbulence-v3-${size}`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="3" seed="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={earned ? 1.8 : 0} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${id})`}>
        <circle cx={C} cy={C} r={R} fill={fill} stroke={ink} strokeWidth={3} />
        {/* Inner ring */}
        <circle cx={C} cy={C} r={R * 0.68} fill="none" stroke={ink} strokeWidth={1.5} />
      </g>
      {/* Star burst / check */}
      {earned ? (
        <text x={C} y={C + 5} textAnchor="middle" fontSize={size * 0.3} fill="white" fontWeight="bold">
          ★
        </text>
      ) : (
        <text x={C} y={C + 4} textAnchor="middle" fontSize={size * 0.22} fill={ink} opacity={0.5}>
          INK
        </text>
      )}
    </svg>
  );
}

/** V4 — Modern Badge: clean circle + minimalist cross motif */
function V4({ earned, size = 56 }: StampProps) {
  const C = size / 2;
  const R = size * 0.44;
  const arm = size * 0.15;
  const ink = earned ? "#0369a1" : "#d1d5db";
  const fill = earned ? "#0ea5e9" : "transparent";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={C} cy={C} r={R} fill={fill} stroke={ink} strokeWidth={2} />
      {earned ? (
        // Checkmark
        <polyline
          points={`${C - arm * 0.8},${C} ${C - arm * 0.1},${C + arm * 0.7} ${C + arm},${C - arm * 0.5}`}
          fill="none"
          stroke="white"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          {/* Plus cross */}
          <line x1={C} y1={C - arm} x2={C} y2={C + arm} stroke={ink} strokeWidth={2} strokeLinecap="round" />
          <line x1={C - arm} y1={C} x2={C + arm} y2={C} stroke={ink} strokeWidth={2} strokeLinecap="round" />
          {/* Corner dots */}
          {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dy], i) => (
            <circle key={i} cx={C + dx * arm} cy={C + dy * arm} r={2} fill={ink} />
          ))}
        </>
      )}
    </svg>
  );
}

/** V5 — Postmark / Cancellation: wavy lines across a circle */
function V5({ earned, size = 56 }: StampProps) {
  const C = size / 2;
  const R = size * 0.43;
  const ink = earned ? "#991b1b" : "#d1d5db";
  const fill = earned ? "#dc2626" : "transparent";
  const id = `clip-v5-${size}`;

  // Generate wavy line paths clipped to circle
  const lines = Array.from({ length: 5 }, (_, i) => {
    const y0 = C - R * 0.6 + i * (R * 0.3);
    const amp = size * 0.06;
    const w = R * 2;
    return `M ${C - w / 2} ${y0} C ${C - w / 4} ${y0 - amp}, ${C + w / 4} ${y0 + amp}, ${C + w / 2} ${y0}`;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <circle cx={C} cy={C} r={R - 1} />
        </clipPath>
      </defs>
      <circle cx={C} cy={C} r={R} fill={fill} stroke={ink} strokeWidth={2} />
      {earned && (
        <g clipPath={`url(#${id})`}>
          {lines.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
          ))}
          {/* SUIKI arc text */}
          <text x={C} y={C - R * 0.22} textAnchor="middle" fontSize={size * 0.15} fill="white" fontWeight="700" letterSpacing={2}>
            SUIKI
          </text>
        </g>
      )}
      {!earned && lines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={ink} strokeWidth={1} opacity={0.4} />
      ))}
    </svg>
  );
}

/** V6 — Playful Bubble: filled with small dots pattern, friendly */
function V6({ earned, size = 56 }: StampProps) {
  const C = size / 2;
  const R = size * 0.44;
  const ink = earned ? "#065f46" : "#d1d5db";
  const fill = earned ? "#10b981" : "transparent";
  const id = `clip-v6-${size}`;

  // Dot grid
  const dots: { cx: number; cy: number; r: number }[] = [];
  const spacing = size * 0.14;
  for (let row = -2; row <= 2; row++) {
    for (let col = -2; col <= 2; col++) {
      const x = C + col * spacing;
      const y = C + row * spacing;
      const dist = Math.sqrt((x - C) ** 2 + (y - C) ** 2);
      if (dist < R - 6) {
        dots.push({ cx: x, cy: y, r: size * 0.045 });
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <circle cx={C} cy={C} r={R} />
        </clipPath>
      </defs>
      <circle cx={C} cy={C} r={R} fill={fill} stroke={ink} strokeWidth={2} />
      {earned && (
        <g clipPath={`url(#${id})`}>
          {dots.map((d, i) => (
            <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="rgba(255,255,255,0.35)" />
          ))}
          <text x={C} y={C + size * 0.1} textAnchor="middle" fontSize={size * 0.3} fill="white">
            ✓
          </text>
        </g>
      )}
      {!earned && dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={ink} opacity={0.18} />
      ))}
    </svg>
  );
}

const STAMP_COMPONENTS = [V1, V2, V3, V4, V5, V6];

// ---------------------------------------------------------------------------
// Variant metadata
// ---------------------------------------------------------------------------

const VARIANTS = [
  {
    id: 1,
    name: "Classic Passport",
    desc: "Double ring + radial ticks — timeless collector feel",
    palette: { bg: "#eef2f7", ring: "#1e3a5f", badge: "#1e3a5f", text: "#fff" },
    vibe: "Collector · Heritage · Trust",
  },
  {
    id: 2,
    name: "Wax Seal",
    desc: "Scalloped seal edge — premium, luxurious brand feel",
    palette: { bg: "#f5f3ff", ring: "#7c3aed", badge: "#7c3aed", text: "#fff" },
    vibe: "Premium · Exclusive · Luxury",
  },
  {
    id: 3,
    name: "Rough Ink",
    desc: "Imperfect rubber stamp — authentic, artisan character",
    palette: { bg: "#fffbeb", ring: "#92400e", badge: "#b45309", text: "#fff" },
    vibe: "Artisan · Handcrafted · Warm",
  },
  {
    id: 4,
    name: "Modern Badge",
    desc: "Clean circle + cross — minimal contemporary design",
    palette: { bg: "#f0f9ff", ring: "#0369a1", badge: "#0ea5e9", text: "#fff" },
    vibe: "Minimal · Tech · Clean",
  },
  {
    id: 5,
    name: "Postmark",
    desc: "Postal cancellation style — nostalgic, graphic, fun",
    palette: { bg: "#fef2f2", ring: "#991b1b", badge: "#dc2626", text: "#fff" },
    vibe: "Nostalgic · Bold · Graphic",
  },
  {
    id: 6,
    name: "Playful Bubble",
    desc: "Dot-pattern circle — friendly, approachable, joyful",
    palette: { bg: "#f0fdf4", ring: "#065f46", badge: "#10b981", text: "#fff" },
    vibe: "Fun · Friendly · Approachable",
  },
] as const;

// ---------------------------------------------------------------------------
// StampSlot — single interactive slot
// ---------------------------------------------------------------------------

interface SlotProps {
  index: number;
  earned: boolean;
  animating: boolean;
  variantIndex: number;
  onEarn: (index: number) => void;
}

function StampSlot({ index, earned, animating, variantIndex, onEarn }: SlotProps) {
  const StampComponent = STAMP_COMPONENTS[variantIndex];

  return (
    <button
      onClick={() => !earned && onEarn(index)}
      aria-label={earned ? `Stamp ${index + 1} earned` : `Earn stamp ${index + 1}`}
      className="relative flex items-center justify-center tap-target"
      style={{ width: 56, height: 56 }}
    >
      {/* Empty ghost ring */}
      {!earned && (
        <div
          className="absolute inset-0 rounded-full border-2 border-dashed"
          style={{ borderColor: "#d1d5db" }}
        />
      )}

      {/* Stamp — spring in when earned */}
      <AnimatePresence>
        {earned && (
          <motion.div
            key="stamp"
            initial={{ scale: 0, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 14 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <StampComponent earned size={56} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ripple on earn */}
      <AnimatePresence>
        {animating && (
          <motion.div
            key="ripple"
            initial={{ scale: 0.4, opacity: 0.7 }}
            animate={{ scale: 2.8, opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: VARIANTS[variantIndex].palette.badge,
              borderRadius: "50%",
            }}
          />
        )}
      </AnimatePresence>
    </button>
  );
}

// ---------------------------------------------------------------------------
// VariantCard — full card for one stamp style
// ---------------------------------------------------------------------------

const TOTAL = 8;

function VariantCard({ variantIndex }: { variantIndex: number }) {
  const v = VARIANTS[variantIndex];
  const StampPreview = STAMP_COMPONENTS[variantIndex];
  const [earned, setEarned] = useState<boolean[]>(Array(TOTAL).fill(false));
  const [animatingSlot, setAnimatingSlot] = useState<number | null>(null);
  const [cardThudKey, setCardThudKey] = useState(0);

  const handleEarn = useCallback((index: number) => {
    setEarned((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
    setAnimatingSlot(index);
    setCardThudKey((k) => k + 1);
    setTimeout(() => setAnimatingSlot(null), 600);
  }, []);

  const handleReset = useCallback(() => {
    setEarned(Array(TOTAL).fill(false));
  }, []);

  const earnedCount = earned.filter(Boolean).length;
  const isComplete = earnedCount === TOTAL;

  return (
    <motion.div
      key={`thud-${cardThudKey}`}
      animate={cardThudKey > 0 ? { y: [0, -4, 2, -1, 0] } : {}}
      transition={{ duration: 0.38, ease: "easeOut" }}
      className="rounded-(--radius-xl) overflow-hidden"
      style={{
        background: v.palette.bg,
        border: `1.5px solid ${v.palette.ring}22`,
        boxShadow: `0 2px 12px ${v.palette.badge}18`,
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${v.palette.ring}18` }}
      >
        <div>
          <p
            className="text-[14px] font-bold"
            style={{ color: v.palette.ring, fontFamily: "var(--font-display)" }}
          >
            {v.name}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: v.palette.ring, opacity: 0.65 }}>
            {v.vibe}
          </p>
        </div>

        {/* Stamp preview (always earned=true) */}
        <div style={{ opacity: 0.9 }}>
          <StampPreview earned size={40} />
        </div>
      </div>

      {/* Stamp grid */}
      <div className="px-4 py-4">
        <p className="text-[12px] font-medium mb-3" style={{ color: v.palette.ring, opacity: 0.5 }}>
          Tap empty slots to try it →
        </p>

        <div className="flex flex-wrap gap-2">
          {Array.from({ length: TOTAL }, (_, i) => (
            <StampSlot
              key={i}
              index={i}
              earned={earned[i]}
              animating={animatingSlot === i}
              variantIndex={variantIndex}
              onEarn={handleEarn}
            />
          ))}
        </div>

        {/* Completion celebration */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 text-center py-2 rounded-full text-[12px] font-semibold"
              style={{
                background: v.palette.badge,
                color: v.palette.text,
              }}
            >
              🎉 Card complete!
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress + reset */}
        <div className="flex items-center justify-between mt-3">
          <p className="text-[12px]" style={{ color: v.palette.ring, opacity: 0.55 }}>
            {earnedCount}/{TOTAL} stamps
          </p>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] tap-target px-2 py-1 rounded-full"
            style={{ color: v.palette.ring, opacity: 0.55 }}
          >
            <RotateCcw size={10} />
            Reset
          </button>
        </div>
      </div>

      {/* Description */}
      <div
        className="px-4 pb-4"
        style={{ borderTop: `1px solid ${v.palette.ring}10`, paddingTop: 12 }}
      >
        <p className="text-[12px]" style={{ color: v.palette.ring, opacity: 0.6 }}>
          {v.desc}
        </p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StampShowcasePage() {
  return (
    <div className="min-h-dvh bg-(--color-bg-base)">
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{
          background: "rgba(248,250,252,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <Link
          href="/customer"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-(--color-surface) border border-(--color-border) tap-target"
        >
          <ChevronLeft size={18} className="text-(--color-text-secondary)" />
        </Link>
        <div>
          <p
            className="text-[17px] font-bold text-(--color-text-primary)"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Pick Your Stamp Style
          </p>
          <p className="text-[12px] text-(--color-text-secondary)">
            Tap the empty circles to try each style
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="px-4 py-5 flex flex-col gap-4 mx-auto w-full max-w-[480px]">
        {VARIANTS.map((_, i) => (
          <VariantCard key={i} variantIndex={i} />
        ))}

        {/* Footer note */}
        <p className="text-center text-[12px] text-(--color-text-muted) pb-8 pt-2">
          Tell Claude which style you want — it'll be built into the card detail page.
        </p>
      </div>
    </div>
  );
}
