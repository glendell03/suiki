"use client";

import Link from "next/link";
import {
  Stamp,
  CreditCard,
  Gift,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { motion } from "framer-motion";
import type { ComponentType } from "react";

/** Describes a single tile in the feature shortcut grid. */
type FeatureTile = {
  id: string;
  href: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  title: string;
  subtitle: string;
  fromColor: string;
  toColor: string;
  borderColor: string;
  accentColor: string;
};

/**
 * Feature tile definitions for the customer home page grid.
 *
 * B&W theme: tiles use light gray gradients with near-black accents.
 * Rewards keeps amber as the loyalty accent.
 */
const FEATURES: FeatureTile[] = [
  {
    id: "scan",
    href: "/customer/scan",
    icon: Stamp,
    title: "Earn Stamps",
    subtitle: "Scan at any store",
    fromColor: "rgba(245,245,245,1)",
    toColor: "rgba(232,232,232,1)",
    borderColor: "rgba(0,0,0,0.1)",
    accentColor: "#111111",
  },
  {
    id: "cards",
    href: "/customer/cards",
    icon: CreditCard,
    title: "My Cards",
    subtitle: "View all progress",
    fromColor: "rgba(248,248,248,1)",
    toColor: "rgba(236,236,236,1)",
    borderColor: "rgba(0,0,0,0.1)",
    accentColor: "#374151",
  },
  {
    id: "rewards",
    href: "/customer/cards", // TODO: replace with /customer/rewards when route exists
    icon: Gift,
    title: "Rewards",
    subtitle: "Redeem your stamps",
    fromColor: "rgba(255,251,243,1)",
    toColor: "rgba(254,243,199,1)",
    borderColor: "rgba(217,119,6,0.2)",
    accentColor: "#d97706",
  },
  {
    id: "lucky",
    href: "/customer/scan", // TODO: replace with /customer/lucky-draw when route exists
    icon: Sparkles,
    title: "Lucky Draw",
    subtitle: "Stamp holders only",
    fromColor: "rgba(243,243,243,1)",
    toColor: "rgba(228,228,228,1)",
    borderColor: "rgba(0,0,0,0.12)",
    accentColor: "#000000",
  },
];

/**
 * FeatureGrid -- 2x2 grid of feature shortcut tiles for the customer home page.
 *
 * Each tile is a gradient glass card with a Lucide icon, title, subtitle,
 * and an ArrowUpRight indicator. Framer Motion whileTap provides press feedback.
 *
 * Colors use inline styles (gradient values are data, not design tokens).
 */
export function FeatureGrid() {
  return (
    <div
      className="grid grid-cols-2 gap-3"
      aria-label="Feature shortcuts"
    >
      {FEATURES.map((f) => {
        const Icon = f.icon;
        return (
          <Link key={f.id} href={f.href}>
            <motion.div
              whileTap={{ scale: 0.96 }}
              className="relative flex flex-col justify-between rounded-2xl border p-4"
              style={{
                background: `linear-gradient(135deg, ${f.fromColor}, ${f.toColor})`,
                borderColor: f.borderColor,
                minHeight: "96px",
              }}
            >
              {/* Arrow top-right */}
              <ArrowUpRight
                size={14}
                className="absolute right-3 top-3 opacity-50"
                style={{ color: f.accentColor }}
                aria-hidden={true}
              />

              {/* Icon */}
              <Icon
                size={22}
                strokeWidth={1.8}
                style={{ color: f.accentColor }}
                aria-hidden={true}
              />

              {/* Text */}
              <div className="mt-3">
                <p className="text-sm font-bold leading-tight text-(--color-text-primary)">
                  {f.title}
                </p>
                <p
                  className="mt-0.5 text-[10px] font-medium leading-tight opacity-80"
                  style={{ color: f.accentColor }}
                >
                  {f.subtitle}
                </p>
              </div>
            </motion.div>
          </Link>
        );
      })}
    </div>
  );
}

export default FeatureGrid;
