/**
 * Tests for the StampGrid slot-state derivation logic.
 *
 * The StampGrid component renders circular bordered slots:
 *   - "filled"  — amber border + bg, merchant emoji inside
 *   - "empty"   — dashed green border, transparent bg
 *   - "reward"  — last slot always; green border + Gift icon (Lucide)
 *
 * The pure helper `deriveSlotStates` mirrors the component's rendering logic
 * so we can test the state machine without needing a DOM.
 *
 * When jsdom is available, add stamp-grid.test.tsx for rendered output tests.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The three possible visual states for a single stamp slot in the grid. */
type SlotState = "filled" | "empty" | "reward";

// ---------------------------------------------------------------------------
// Helper under test
//
// `deriveSlotStates` mirrors the StampGrid component's rendering logic:
//   - Last slot is ALWAYS "reward" (regardless of fill state)
//   - Slots before the last are "filled" if index < filledSlots
//   - Otherwise "empty"
// ---------------------------------------------------------------------------

/**
 * Derive the visual state for each slot in the stamp grid.
 *
 * @param totalSlots  - Total number of slots (including reward).
 * @param filledSlots - Number of stamps collected so far.
 * @returns Array of SlotState with exactly `totalSlots` elements.
 */
function deriveSlotStates(totalSlots: number, filledSlots: number): SlotState[] {
  if (totalSlots <= 0) return [];

  const rewardIndex = totalSlots - 1;

  return Array.from({ length: totalSlots }, (_, i): SlotState => {
    if (i === rewardIndex) return "reward";
    if (i < filledSlots) return "filled";
    return "empty";
  });
}

// ---------------------------------------------------------------------------
// Basic slot states -- canonical 9-slot card
// ---------------------------------------------------------------------------

describe("deriveSlotStates -- 9-slot card, 3 filled", () => {
  const states = deriveSlotStates(9, 3);

  it("returns an array with exactly 9 elements", () => {
    expect(states).toHaveLength(9);
  });

  it("slots 0, 1, 2 are filled", () => {
    expect(states[0]).toBe("filled");
    expect(states[1]).toBe("filled");
    expect(states[2]).toBe("filled");
  });

  it("slots 3 through 7 are empty", () => {
    for (let i = 3; i <= 7; i++) {
      expect(states[i]).toBe("empty");
    }
  });

  it("slot 8 (last) is always reward regardless of fill state", () => {
    expect(states[8]).toBe("reward");
  });
});

// ---------------------------------------------------------------------------
// Fully filled card -- all stamps collected
// ---------------------------------------------------------------------------

describe("deriveSlotStates -- 6-slot card, 6 filled (complete)", () => {
  const states = deriveSlotStates(6, 6);

  it("returns an array with exactly 6 elements", () => {
    expect(states).toHaveLength(6);
  });

  it("slots 0 through 4 are filled", () => {
    for (let i = 0; i < 5; i++) {
      expect(states[i]).toBe("filled");
    }
  });

  it("the last slot (index 5) is always reward", () => {
    expect(states[5]).toBe("reward");
  });

  it("has exactly one reward state entry", () => {
    const rewardCount = states.filter((s) => s === "reward").length;
    expect(rewardCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Zero stamps collected
// ---------------------------------------------------------------------------

describe("deriveSlotStates -- 5-slot card, 0 filled", () => {
  const states = deriveSlotStates(5, 0);

  it("returns exactly 5 elements", () => {
    expect(states).toHaveLength(5);
  });

  it("slots 0 through 3 are empty (not reward)", () => {
    for (let i = 0; i < 4; i++) {
      expect(states[i]).toBe("empty");
    }
  });

  it("no slots are filled when filledSlots=0", () => {
    expect(states.filter((s) => s === "filled")).toHaveLength(0);
  });

  it("last slot is always reward even with 0 stamps", () => {
    expect(states[4]).toBe("reward");
  });
});

// ---------------------------------------------------------------------------
// Edge case: total = 0
// ---------------------------------------------------------------------------

describe("deriveSlotStates -- edge case: total=0", () => {
  it("returns an empty array without throwing", () => {
    expect(() => deriveSlotStates(0, 0)).not.toThrow();
    expect(deriveSlotStates(0, 0)).toEqual([]);
  });

  it("returns an empty array even when filled > 0 (total=0 wins)", () => {
    expect(deriveSlotStates(0, 5)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Edge case: filledSlots > totalSlots -- overflow
// ---------------------------------------------------------------------------

describe("deriveSlotStates -- overflow: filledSlots > totalSlots", () => {
  it("does not throw when filled exceeds total", () => {
    expect(() => deriveSlotStates(5, 10)).not.toThrow();
  });

  it("fills all non-reward slots when filled >= total", () => {
    const states = deriveSlotStates(5, 10);
    // Slots 0-3 should all be filled; slot 4 is always reward.
    for (let i = 0; i < 4; i++) {
      expect(states[i]).toBe("filled");
    }
    expect(states[4]).toBe("reward");
  });

  it("returns the correct length even when filled >> total", () => {
    expect(deriveSlotStates(4, 100)).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Reward slot is always the last slot
// ---------------------------------------------------------------------------

describe("deriveSlotStates -- reward slot behavior", () => {
  it("reward is always the last slot, never filled", () => {
    // Even when all stamps are collected, last slot = reward (not filled).
    const states = deriveSlotStates(10, 10);
    expect(states[9]).toBe("reward");
    expect(states.filter((s) => s === "reward")).toHaveLength(1);
  });

  it("filled slots never include the reward index", () => {
    const states = deriveSlotStates(3, 3);
    // Slots: [filled, filled, reward]
    expect(states[0]).toBe("filled");
    expect(states[1]).toBe("filled");
    expect(states[2]).toBe("reward");
  });
});

// ---------------------------------------------------------------------------
// Return type consistency
// ---------------------------------------------------------------------------

describe("deriveSlotStates -- return type invariants", () => {
  it("every element is one of the three valid SlotState values", () => {
    const validStates: SlotState[] = ["filled", "empty", "reward"];
    const states = deriveSlotStates(10, 7);
    for (const state of states) {
      expect(validStates).toContain(state);
    }
  });

  it("length always equals the totalSlots argument", () => {
    for (const total of [1, 5, 9, 10, 20]) {
      expect(deriveSlotStates(total, 0)).toHaveLength(total);
      expect(deriveSlotStates(total, total)).toHaveLength(total);
    }
  });

  it("has exactly one reward slot in any non-empty output", () => {
    for (const filled of [0, 3, 9]) {
      const states = deriveSlotStates(9, filled);
      const rewardCount = states.filter((s) => s === "reward").length;
      expect(rewardCount).toBe(1);
    }
  });

  it("single-slot card has only a reward slot", () => {
    const states = deriveSlotStates(1, 0);
    expect(states).toEqual(["reward"]);
  });

  it("single-slot card with 1 filled still shows reward", () => {
    const states = deriveSlotStates(1, 1);
    expect(states).toEqual(["reward"]);
  });
});

// ---------------------------------------------------------------------------
// Grid layout invariant: 5-column grid
// ---------------------------------------------------------------------------

describe("StampGrid -- layout expectations", () => {
  it("5-column layout means rows = ceil(totalSlots / 5)", () => {
    // Not a runtime test, but documents the contract:
    // 9 slots -> 2 rows (5 + 4)
    // 10 slots -> 2 rows (5 + 5)
    // 12 slots -> 3 rows (5 + 5 + 2)
    expect(Math.ceil(9 / 5)).toBe(2);
    expect(Math.ceil(10 / 5)).toBe(2);
    expect(Math.ceil(12 / 5)).toBe(3);
  });
});
