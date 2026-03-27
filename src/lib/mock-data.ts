/**
 * Static mock data for dev/preview mode.
 *
 * Loaded when NEXT_PUBLIC_MOCK_WALLET is set (development only).
 * Never imported in production builds.
 */

import type { StampCard, StampProgram } from "@/types/sui";

export const MOCK_WALLET_ADDRESS =
  process.env.NEXT_PUBLIC_MOCK_WALLET ?? "";

export const MOCK_PROGRAMS: StampProgram[] = [
  {
    objectId: "0xaaaa0000000000000000000000000000000000000000000000000000000000aa" as `0x${string}`,
    merchant: MOCK_WALLET_ADDRESS as `0x${string}`,
    name: "Brew Bay Coffee",
    logoUrl: "",
    stampsRequired: 10,
    rewardDescription: "One free large coffee of your choice",
    totalIssued: 47,
  },
  {
    objectId: "0xbbbb0000000000000000000000000000000000000000000000000000000000bb" as `0x${string}`,
    merchant: MOCK_WALLET_ADDRESS as `0x${string}`,
    name: "Mang Juan's Bakery",
    logoUrl: "",
    stampsRequired: 8,
    rewardDescription: "Free dozen pandesal",
    totalIssued: 23,
  },
  {
    objectId: "0xcccc0000000000000000000000000000000000000000000000000000000000cc" as `0x${string}`,
    merchant: MOCK_WALLET_ADDRESS as `0x${string}`,
    name: "Boba Dream",
    logoUrl: "",
    stampsRequired: 6,
    rewardDescription: "Free large milk tea",
    totalIssued: 11,
  },
];

export const MOCK_CARDS: StampCard[] = [
  {
    objectId: "0xcard0000000000000000000000000000000000000000000000000000000000a1" as `0x${string}`,
    programId: "0xaaaa0000000000000000000000000000000000000000000000000000000000aa" as `0x${string}`,
    customer: MOCK_WALLET_ADDRESS as `0x${string}`,
    merchantName: "Brew Bay Coffee",
    merchantLogo: "",
    stampsRequired: 10,
    currentStamps: 7,
    totalEarned: 1,
    lastStamped: Date.now() - 86_400_000,
  },
  {
    objectId: "0xcard0000000000000000000000000000000000000000000000000000000000b2" as `0x${string}`,
    programId: "0xbbbb0000000000000000000000000000000000000000000000000000000000bb" as `0x${string}`,
    customer: MOCK_WALLET_ADDRESS as `0x${string}`,
    merchantName: "Mang Juan's Bakery",
    merchantLogo: "",
    stampsRequired: 8,
    currentStamps: 8,
    totalEarned: 0,
    lastStamped: Date.now() - 172_800_000,
  },
  {
    objectId: "0xcard0000000000000000000000000000000000000000000000000000000000c3" as `0x${string}`,
    programId: "0xcccc0000000000000000000000000000000000000000000000000000000000cc" as `0x${string}`,
    customer: MOCK_WALLET_ADDRESS as `0x${string}`,
    merchantName: "Boba Dream",
    merchantLogo: "",
    stampsRequired: 6,
    currentStamps: 2,
    totalEarned: 0,
    lastStamped: Date.now() - 432_000_000,
  },
];
