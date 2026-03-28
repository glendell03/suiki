"use client";

/**
 * Themed stamp slot components for the Suiki loyalty card system.
 *
 * Each theme is a circular SVG that renders differently based on whether
 * the slot is earned or empty. The ThemedStampGrid renders a full flex-wrap
 * grid and is a drop-in replacement for PostageStampGrid on the card detail page.
 */

import { useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getTheme } from "@/lib/stamp-themes";

// ---------------------------------------------------------------------------
// Shared prop type
// ---------------------------------------------------------------------------

export interface StampSlotProps {
  /** Whether this slot has been earned. */
  earned: boolean;
  /** Diameter in px. @default 56 */
  size?: number;
  /** Theme ID (0-5). @default 0 */
  themeId?: number;
}

// ---------------------------------------------------------------------------
// Theme 0 -- Classic Passport: double ring + radial ticks
// ---------------------------------------------------------------------------

function Theme0({ earned, size = 56, themeId = 0 }: StampSlotProps) {
  const theme = getTheme(themeId);
  const C = size / 2;
  const R1 = size * 0.455;
  const R2 = size * 0.32;
  const ink = earned ? theme.inkColor : "#d1d5db";
  const fill = earned ? theme.fillColor : "transparent";

  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 - 90) * (Math.PI / 180);
    return {
      x1: C + Math.cos(a) * (R2 + 2),
      y1: C + Math.sin(a) * (R2 + 2),
      x2: C + Math.cos(a) * (R1 - 2),
      y2: C + Math.sin(a) * (R1 - 2),
    };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <circle cx={C} cy={C} r={R1} fill="none" stroke={ink} strokeWidth={1.8} />
      <circle cx={C} cy={C} r={R2} fill={fill} stroke={ink} strokeWidth={1.2} />
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={ink}
          strokeWidth={1}
        />
      ))}
      {earned && (
        <text
          x={C}
          y={C + 4}
          textAnchor="middle"
          fontSize={size * 0.28}
          fill={theme.textColor}
          fontFamily="serif"
          fontWeight="bold"
        >
          ✓
        </text>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 1 -- Wax Seal: scalloped gear edge + monogram
// ---------------------------------------------------------------------------

function Theme1({ earned, size = 56, themeId = 1 }: StampSlotProps) {
  const theme = getTheme(themeId);
  const C = size / 2;
  const R = size * 0.42;
  const BUMPS = 16;
  const bumpH = size * 0.055;
  const ink = earned ? theme.inkColor : "#d1d5db";
  const fill = earned ? theme.fillColor : "transparent";

  const points: string[] = [];
  for (let i = 0; i <= BUMPS * 2; i++) {
    const a = ((i * 180) / BUMPS - 90) * (Math.PI / 180);
    const r = i % 2 === 0 ? R : R - bumpH;
    points.push(`${C + Math.cos(a) * r},${C + Math.sin(a) * r}`);
  }
  const d = `M ${points.join(" L ")} Z`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <path
        d={d}
        fill={fill}
        stroke={ink}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle cx={C} cy={C} r={R * 0.58} fill="none" stroke={ink} strokeWidth={1} />
      <text
        x={C}
        y={C + size * 0.1}
        textAnchor="middle"
        fontSize={size * (earned ? 0.28 : 0.32)}
        fill={earned ? theme.textColor : ink}
        fontFamily="serif"
        fontWeight="bold"
      >
        {earned ? "✓" : "S"}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 2 -- Rough Ink: rubber stamp + turbulence filter
// ---------------------------------------------------------------------------

function Theme2({ earned, size = 56, themeId = 2 }: StampSlotProps) {
  const theme = getTheme(themeId);
  const C = size / 2;
  const R = size * 0.43;
  const ink = earned ? theme.inkColor : "#d1d5db";
  const fill = earned ? theme.fillColor : "transparent";
  const uid = useId();
  const filterId = `ink-turbulence-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <defs>
        <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.04"
            numOctaves={3}
            seed={2}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={earned ? 1.8 : 0}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        <circle cx={C} cy={C} r={R} fill={fill} stroke={ink} strokeWidth={3} />
        <circle
          cx={C}
          cy={C}
          r={R * 0.68}
          fill="none"
          stroke={ink}
          strokeWidth={1.5}
        />
      </g>
      {earned ? (
        <text
          x={C}
          y={C + 5}
          textAnchor="middle"
          fontSize={size * 0.3}
          fill={theme.textColor}
          fontWeight="bold"
        >
          ★
        </text>
      ) : (
        <text
          x={C}
          y={C + 4}
          textAnchor="middle"
          fontSize={size * 0.18}
          fill={ink}
          opacity={0.45}
          letterSpacing={1}
        >
          INK
        </text>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 3 -- Modern Badge: clean circle + cross/checkmark
// ---------------------------------------------------------------------------

function Theme3({ earned, size = 56, themeId = 3 }: StampSlotProps) {
  const theme = getTheme(themeId);
  const C = size / 2;
  const R = size * 0.44;
  const arm = size * 0.15;
  const ink = earned ? theme.inkColor : "#d1d5db";
  const fill = earned ? theme.fillColor : "transparent";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <circle cx={C} cy={C} r={R} fill={fill} stroke={ink} strokeWidth={2} />
      {earned ? (
        <polyline
          points={`${C - arm * 0.8},${C} ${C - arm * 0.1},${C + arm * 0.7} ${C + arm},${C - arm * 0.5}`}
          fill="none"
          stroke={theme.textColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <line
            x1={C}
            y1={C - arm}
            x2={C}
            y2={C + arm}
            stroke={ink}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <line
            x1={C - arm}
            y1={C}
            x2={C + arm}
            y2={C}
            stroke={ink}
            strokeWidth={2}
            strokeLinecap="round"
          />
          {(
            [
              [-1, -1],
              [1, -1],
              [1, 1],
              [-1, 1],
            ] as const
          ).map(([dx, dy], i) => (
            <circle
              key={i}
              cx={C + dx * arm}
              cy={C + dy * arm}
              r={2}
              fill={ink}
            />
          ))}
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 4 -- Postmark: wavy cancellation lines through circle
// ---------------------------------------------------------------------------

function Theme4({ earned, size = 56, themeId = 4 }: StampSlotProps) {
  const theme = getTheme(themeId);
  const C = size / 2;
  const R = size * 0.43;
  const ink = earned ? theme.inkColor : "#d1d5db";
  const fill = earned ? theme.fillColor : "transparent";
  const uid = useId();
  const clipId = `postmark-clip-${uid}`;

  const wavePaths = Array.from({ length: 5 }, (_, i) => {
    const y0 = C - R * 0.55 + i * (R * 0.28);
    const amp = size * 0.06;
    const w = R * 2;
    return `M ${C - w / 2} ${y0} C ${C - w / 4} ${y0 - amp}, ${C + w / 4} ${y0 + amp}, ${C + w / 2} ${y0}`;
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={C} cy={C} r={R - 1} />
        </clipPath>
      </defs>
      <circle cx={C} cy={C} r={R} fill={fill} stroke={ink} strokeWidth={2} />
      {earned ? (
        <g clipPath={`url(#${clipId})`}>
          {wavePaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={1.5}
            />
          ))}
          <text
            x={C}
            y={C - R * 0.2}
            textAnchor="middle"
            fontSize={size * 0.15}
            fill={theme.textColor}
            fontWeight="700"
            letterSpacing={2}
          >
            SUIKI
          </text>
          <text
            x={C}
            y={C + R * 0.35}
            textAnchor="middle"
            fontSize={size * 0.12}
            fill={theme.textColor}
            opacity={0.8}
          >
            ✓
          </text>
        </g>
      ) : (
        wavePaths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={ink}
            strokeWidth={1}
            opacity={0.35}
          />
        ))
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 5 -- Playful Bubble: dot-fill pattern + check
// ---------------------------------------------------------------------------

function Theme5({ earned, size = 56, themeId = 5 }: StampSlotProps) {
  const theme = getTheme(themeId);
  const C = size / 2;
  const R = size * 0.44;
  const ink = earned ? theme.inkColor : "#d1d5db";
  const fill = earned ? theme.fillColor : "transparent";
  const uid = useId();
  const clipId = `bubble-clip-${uid}`;

  const dots: { cx: number; cy: number }[] = [];
  const spacing = size * 0.14;
  for (let row = -2; row <= 2; row++) {
    for (let col = -2; col <= 2; col++) {
      const x = C + col * spacing;
      const y = C + row * spacing;
      if (Math.sqrt((x - C) ** 2 + (y - C) ** 2) < R - 6) {
        dots.push({ cx: x, cy: y });
      }
    }
  }
  const dotR = size * 0.045;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={C} cy={C} r={R} />
        </clipPath>
      </defs>
      <circle cx={C} cy={C} r={R} fill={fill} stroke={ink} strokeWidth={2} />
      {earned ? (
        <g clipPath={`url(#${clipId})`}>
          {dots.map((d, i) => (
            <circle
              key={i}
              cx={d.cx}
              cy={d.cy}
              r={dotR}
              fill="rgba(255,255,255,0.3)"
            />
          ))}
          <text
            x={C}
            y={C + size * 0.1}
            textAnchor="middle"
            fontSize={size * 0.3}
            fill={theme.textColor}
          >
            ✓
          </text>
        </g>
      ) : (
        dots.map((d, i) => (
          <circle
            key={i}
            cx={d.cx}
            cy={d.cy}
            r={dotR}
            fill={ink}
            opacity={0.18}
          />
        ))
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 6 -- Gold Foil: thin double ring + fine cross-hatch pattern
// ---------------------------------------------------------------------------

function Theme6({ earned, size = 56, themeId = 6 }: StampSlotProps) {
  const theme = getTheme(themeId);
  const uid = useId();
  const clipId = `gold-clip-${uid}`;
  const C = size / 2;
  const R = size * 0.44;
  const ink = earned ? theme.inkColor : "#d1d5db";
  const fill = earned ? theme.fillColor : "transparent";

  // Cross-hatch lines (clipped to circle)
  const hatch: string[] = [];
  const spacing = size * 0.1;
  for (let i = -3; i <= 6; i++) {
    const offset = i * spacing;
    hatch.push(`M ${C - R + offset} ${C - R} L ${C + R + offset} ${C + R}`);
    hatch.push(`M ${C + R + offset} ${C - R} L ${C - R + offset} ${C + R}`);
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <clipPath id={clipId}><circle cx={C} cy={C} r={R - 2} /></clipPath>
      </defs>
      <circle cx={C} cy={C} r={R} fill={fill} stroke={ink} strokeWidth={2} />
      <circle cx={C} cy={C} r={R * 0.8} fill="none" stroke={ink} strokeWidth={0.8} opacity={0.6} />
      {earned && (
        <g clipPath={`url(#${clipId})`}>
          {hatch.map((d, i) => (
            <path key={i} d={d} stroke="rgba(255,255,255,0.15)" strokeWidth={0.8} />
          ))}
          <text x={C} y={C + 5} textAnchor="middle" fontSize={size * 0.28} fill={theme.textColor} fontWeight="bold">
            ✓
          </text>
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 7 -- Neon Glow: glowing circle with feGaussianBlur halo
// ---------------------------------------------------------------------------

function Theme7({ earned, size = 56, themeId = 7 }: StampSlotProps) {
  const theme = getTheme(themeId);
  const uid = useId();
  const glowId = `neon-glow-${uid}`;
  const C = size / 2;
  const R = size * 0.4;
  const ink = earned ? theme.inkColor : "#4b5563";
  const fill = earned ? theme.fillColor : "#1f2937";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={earned ? 3 : 0} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Dark background */}
      <circle cx={C} cy={C} r={C - 1} fill="#0f0f1a" />
      <g filter={`url(#${glowId})`}>
        <circle cx={C} cy={C} r={R} fill={fill} stroke={ink} strokeWidth={2.5} />
      </g>
      {/* Inner accent ring */}
      <circle cx={C} cy={C} r={R * 0.65} fill="none" stroke={ink} strokeWidth={1} opacity={0.5} />
      {earned && (
        <text x={C} y={C + 5} textAnchor="middle" fontSize={size * 0.28} fill={theme.textColor}>
          ✦
        </text>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 8 -- Cherry Blossom: petal shapes around circle border
// ---------------------------------------------------------------------------

function Theme8({ earned, size = 56, themeId = 8 }: StampSlotProps) {
  const theme = getTheme(themeId);
  const C = size / 2;
  const R = size * 0.36;
  const petalR = size * 0.1;
  const orbitR = R + petalR * 0.7;
  const PETALS = 6;
  const ink = earned ? theme.inkColor : "#d1d5db";
  const fill = earned ? theme.fillColor : "transparent";

  const petals = Array.from({ length: PETALS }, (_, i) => {
    const a = (i * 360) / PETALS * (Math.PI / 180) - Math.PI / 2;
    return { cx: C + Math.cos(a) * orbitR, cy: C + Math.sin(a) * orbitR };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {petals.map((p, i) => (
        <ellipse
          key={i}
          cx={p.cx}
          cy={p.cy}
          rx={petalR}
          ry={petalR * 0.65}
          fill={earned ? theme.fillColor : "#e5e7eb"}
          opacity={0.75}
          transform={`rotate(${(i * 360) / PETALS}, ${p.cx}, ${p.cy})`}
        />
      ))}
      <circle cx={C} cy={C} r={R} fill={fill} stroke={ink} strokeWidth={1.5} />
      {earned && (
        <text x={C} y={C + 5} textAnchor="middle" fontSize={size * 0.26} fill={theme.textColor}>
          ✿
        </text>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 9 -- Ocean Wave: concentric arcs creating wave motion
// ---------------------------------------------------------------------------

function Theme9({ earned, size = 56, themeId = 9 }: StampSlotProps) {
  const theme = getTheme(themeId);
  const uid = useId();
  const clipId = `wave-clip-${uid}`;
  const C = size / 2;
  const R = size * 0.44;
  const ink = earned ? theme.inkColor : "#d1d5db";
  const fill = earned ? theme.fillColor : "transparent";

  // Concentric partial arcs
  const arcs = Array.from({ length: 4 }, (_, i) => {
    const r = R * (0.25 + i * 0.2);
    const startA = -Math.PI * 0.8 + i * 0.15;
    const endA = Math.PI * 0.5 + i * 0.1;
    const x1 = C + Math.cos(startA) * r;
    const y1 = C + Math.sin(startA) * r;
    const x2 = C + Math.cos(endA) * r;
    const y2 = C + Math.sin(endA) * r;
    return { d: `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`, r };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <clipPath id={clipId}><circle cx={C} cy={C} r={R - 1} /></clipPath>
      </defs>
      <circle cx={C} cy={C} r={R} fill={fill} stroke={ink} strokeWidth={2} />
      {earned && (
        <g clipPath={`url(#${clipId})`} opacity={0.6}>
          {arcs.map((arc, i) => (
            <path key={i} d={arc.d} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
          ))}
        </g>
      )}
      {earned && (
        <text x={C} y={C + 5} textAnchor="middle" fontSize={size * 0.28} fill={theme.textColor} fontWeight="bold">
          ✓
        </text>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Theme 10 -- Dark Mode: charcoal fill + silver ring + minimal mark
// ---------------------------------------------------------------------------

function Theme10({ earned, size = 56, themeId = 10 }: StampSlotProps) {
  const theme = getTheme(themeId);
  const C = size / 2;
  const R = size * 0.44;
  const ink = earned ? theme.inkColor : "#4b5563";
  const fill = earned ? theme.fillColor : "#111827";
  const bgFill = "#0f172a";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {/* Always-dark background */}
      <circle cx={C} cy={C} r={C - 1} fill={bgFill} />
      <circle cx={C} cy={C} r={R} fill={fill} stroke={ink} strokeWidth={2} />
      {/* Minimalist inner mark */}
      {earned ? (
        <>
          <line x1={C - size * 0.14} y1={C} x2={C + size * 0.14} y2={C} stroke={theme.textColor} strokeWidth={1.5} strokeLinecap="round" />
          <line x1={C} y1={C - size * 0.14} x2={C} y2={C + size * 0.14} stroke={theme.textColor} strokeWidth={1.5} strokeLinecap="round" />
        </>
      ) : (
        <circle cx={C} cy={C} r={size * 0.06} fill={ink} opacity={0.6} />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component dispatch
// ---------------------------------------------------------------------------

const THEME_COMPONENTS = [
  Theme0, Theme1, Theme2, Theme3, Theme4, Theme5,
  Theme6, Theme7, Theme8, Theme9, Theme10,
] as const;

/**
 * Renders the correct stamp SVG for a given theme ID.
 * Falls back to Theme0 if themeId is out of range.
 */
export function StampSlot({ earned, size = 56, themeId = 0 }: StampSlotProps) {
  const idx =
    themeId >= 0 && themeId < THEME_COMPONENTS.length ? themeId : 0;
  const ThemeComponent = THEME_COMPONENTS[idx] ?? Theme0;
  return <ThemeComponent earned={earned} size={size} themeId={themeId} />;
}

// ---------------------------------------------------------------------------
// ThemedStampGrid -- full card grid replacing PostageStampGrid
// ---------------------------------------------------------------------------

interface ThemedStampGridProps {
  /** Number of stamps earned so far. */
  earned: number;
  /** Total stamps required (grid size). */
  total: number;
  /** Theme ID (0-5). @default 0 */
  themeId?: number;
  /**
   * When true the most recently earned stamp plays a spring bounce.
   * @default false
   */
  animateNewStamp?: boolean;
  className?: string;
}

/**
 * A flex-wrap grid of themed circular stamp slots.
 *
 * Drop-in replacement for PostageStampGrid that respects the program's theme.
 *
 * @example
 * <ThemedStampGrid earned={5} total={8} themeId={2} animateNewStamp />
 */
export function ThemedStampGrid({
  earned,
  total,
  themeId = 0,
  animateNewStamp = false,
  className = "",
}: ThemedStampGridProps) {
  const clamped = Math.min(Math.max(0, earned), total);
  const newIdx = clamped - 1;
  const theme = getTheme(themeId);

  return (
    <div
      role="list"
      aria-label={`${clamped} of ${total} stamps earned`}
      className={["flex flex-wrap", className].filter(Boolean).join(" ")}
      style={{ gap: 10 }}
    >
      {Array.from({ length: total }, (_, i) => {
        const isEarned = i < clamped;
        const isNew = animateNewStamp && i === newIdx;
        const label = `Stamp ${i + 1}: ${isEarned ? "earned" : "empty"}`;
        const shadow = isEarned
          ? "drop-shadow(0 2px 6px rgba(0,0,0,0.18))"
          : undefined;

        return (
          // Stable wrapper — same key, same element type always. React never
          // remounts it, so inner motion.div animations are never interrupted.
          <div
            key={i}
            role="listitem"
            aria-label={label}
            className="relative flex-shrink-0"
            style={{ width: 56, height: 56 }}
          >
            {/* Unearned: dashed ghost ring */}
            {!isEarned && (
              <div
                className="absolute inset-0 rounded-full border-2 border-dashed"
                style={{ borderColor: "#d1d5db" }}
              />
            )}

            {/* Earned: stamp with spring-in entry (mirrors showcase AnimatePresence) */}
            <AnimatePresence initial={false}>
              {isEarned && (
                <motion.div
                  key="stamp"
                  className="absolute inset-0"
                  initial={{ scale: 0, rotate: -20, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 14 }}
                  style={{ filter: shadow }}
                >
                  <StampSlot earned size={56} themeId={themeId} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Ripple: expand-fade burst on new stamp (mirrors showcase) */}
            <AnimatePresence>
              {isNew && (
                <motion.div
                  key="ripple"
                  className="absolute inset-0 rounded-full pointer-events-none"
                  initial={{ scale: 0.4, opacity: 0.7 }}
                  animate={{ scale: 2.8, opacity: 0 }}
                  exit={{}}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  style={{ background: theme.fillColor }}
                />
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
