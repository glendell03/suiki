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
 * Colour values are per-tile accent data (teal, green, amber, rose) rather
 * than design tokens -- each tile has its own unique gradient identity that
 * does not map to a single CSS variable.
 */
const FEATURES: FeatureTile[] = [
  {
    id: "scan",
    href: "/customer/scan",
    icon: Stamp,
    title: "Earn Stamps",
    subtitle: "Scan at any store",
    fromColor: "rgba(17,94,89,0.9)",
    toColor: "rgba(6,78,59,0.9)",
    borderColor: "rgba(45,212,191,0.25)",
    accentColor: "#2dd4bf",
  },
  {
    id: "cards",
    href: "/customer/cards",
    icon: CreditCard,
    title: "My Cards",
    subtitle: "View all progress",
    fromColor: "rgba(26,61,42,0.9)",
    toColor: "rgba(19,42,31,0.9)",
    borderColor: "rgba(74,222,128,0.2)",
    accentColor: "#4ade80",
  },
  {
    id: "rewards",
    href: "/customer/cards",
    icon: Gift,
    title: "Rewards",
    subtitle: "Redeem your stamps",
    fromColor: "rgba(120,53,15,0.85)",
    toColor: "rgba(69,26,3,0.85)",
    borderColor: "rgba(245,158,11,0.25)",
    accentColor: "#f59e0b",
  },
  {
    id: "lucky",
    href: "/customer/scan",
    icon: Sparkles,
    title: "Lucky Draw",
    subtitle: "Stamp holders only",
    fromColor: "rgba(136,19,55,0.85)",
    toColor: "rgba(80,7,36,0.85)",
    borderColor: "rgba(244,63,94,0.25)",
    accentColor: "#f43f5e",
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
              />

              {/* Icon */}
              <Icon
                size={22}
                strokeWidth={1.8}
                style={{ color: f.accentColor }}
              />

              {/* Text */}
              <div className="mt-3">
                <p className="text-sm font-bold leading-tight text-white">
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
