/**
 * Unit tests for WalletDropdown utility functions.
 *
 * Tests the exported `truncateAddress` helper which formats Sui addresses
 * for display in the wallet dropdown. Pure unit tests -- no DOM required.
 */

import { describe, it, expect } from "vitest";
import { truncateAddress } from "@/components/wallet-dropdown";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_ADDRESS =
  "0x7d20dcdb2bca4f508ea9613994683eb4e76e9c4ed371169677c1be02aaf0b58e";
const SHORT_ADDRESS = "0xabcdef";

// ---------------------------------------------------------------------------
// truncateAddress
// ---------------------------------------------------------------------------

describe("truncateAddress", () => {
  it("truncates a full-length Sui address to first 6 + last 4 chars", () => {
    const result = truncateAddress(FULL_ADDRESS);
    expect(result).toBe("0x7d20\u2026b58e");
  });

  it("preserves the 0x prefix in the truncated output", () => {
    const result = truncateAddress(FULL_ADDRESS);
    expect(result.startsWith("0x")).toBe(true);
  });

  it("returns addresses of 10 chars or fewer unchanged", () => {
    expect(truncateAddress(SHORT_ADDRESS)).toBe(SHORT_ADDRESS);
    expect(truncateAddress("0x12345678")).toBe("0x12345678");
  });

  it("handles the boundary case at exactly 11 characters", () => {
    const elevenChars = "0x123456789";
    const result = truncateAddress(elevenChars);
    expect(result).toBe("0x1234\u20266789");
  });

  it("returns empty string for empty input", () => {
    expect(truncateAddress("")).toBe("");
  });
});
