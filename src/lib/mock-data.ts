/**
 * Static mock data for dev/preview mode.
 *
 * Loaded when NEXT_PUBLIC_MOCK_WALLET is set (development only).
 * Never imported in production builds.
 */

import type { ProgramWithMetadata, CardWithProgram } from "@/types/db";

export const MOCK_WALLET_ADDRESS =
  process.env.NEXT_PUBLIC_MOCK_WALLET ?? "";

export const MOCK_PROGRAMS: ProgramWithMetadata[] = [
  {
    programId: "0xaaaa0000000000000000000000000000000000000000000000000000000000aa",
    merchantAddress: MOCK_WALLET_ADDRESS,
    name: "Brew Bay Coffee",
    logoUrl: "",
    stampsRequired: 10,
    rewardDescription: "One free large coffee of your choice",
    isActive: true,
    themeId: 0,
  },
  {
    programId: "0xbbbb0000000000000000000000000000000000000000000000000000000000bb",
    merchantAddress: MOCK_WALLET_ADDRESS,
    name: "Mang Juan's Bakery",
    logoUrl: "",
    stampsRequired: 8,
    rewardDescription: "Free dozen pandesal",
    isActive: true,
    themeId: 0,
  },
  {
    programId: "0xcccc0000000000000000000000000000000000000000000000000000000000cc",
    merchantAddress: MOCK_WALLET_ADDRESS,
    name: "Boba Dream",
    logoUrl: "",
    stampsRequired: 6,
    rewardDescription: "Free large milk tea",
    isActive: true,
    themeId: 0,
  },
];

export const MOCK_CARDS: CardWithProgram[] = [
  {
    cardId: "0xcard0000000000000000000000000000000000000000000000000000000000a1",
    programId: "0xaaaa0000000000000000000000000000000000000000000000000000000000aa",
    customerAddress: MOCK_WALLET_ADDRESS,
    merchantName: "Brew Bay Coffee",
    logoUrl: "",
    stampsRequired: 10,
    currentStamps: 7,
    totalEarned: 1,
    lastStampedAt: new Date(Date.now() - 86_400_000).toISOString(),
    rewardDescription: "One free large coffee of your choice",
    isActive: true,
    themeId: 0,
  },
  {
    cardId: "0xcard0000000000000000000000000000000000000000000000000000000000b2",
    programId: "0xbbbb0000000000000000000000000000000000000000000000000000000000bb",
    customerAddress: MOCK_WALLET_ADDRESS,
    merchantName: "Mang Juan's Bakery",
    logoUrl: "",
    stampsRequired: 8,
    currentStamps: 8,
    totalEarned: 0,
    lastStampedAt: new Date(Date.now() - 172_800_000).toISOString(),
    rewardDescription: "Free dozen pandesal",
    isActive: true,
    themeId: 0,
  },
  {
    cardId: "0xcard0000000000000000000000000000000000000000000000000000000000c3",
    programId: "0xcccc0000000000000000000000000000000000000000000000000000000000cc",
    customerAddress: MOCK_WALLET_ADDRESS,
    merchantName: "Boba Dream",
    logoUrl: "",
    stampsRequired: 6,
    currentStamps: 2,
    totalEarned: 0,
    lastStampedAt: new Date(Date.now() - 432_000_000).toISOString(),
    rewardDescription: "Free large milk tea",
    isActive: true,
    themeId: 0,
  },
];
