import { describe, expect, it } from "vitest";
import { updateHoldGesture } from "@/lib/gesture/hold";
import type { HoldState } from "@/lib/types";

function createHoldState(): HoldState {
  return {
    action: null,
    token: 0,
    startedAt: 0,
    pendingLostAt: null,
    lastShownSecond: 0,
    rearmBlockedAction: null,
  };
}

describe("updateHoldGesture", () => {
  it("confirms mode toggles after one second", () => {
    const state = createHoldState();
    const countdowns: unknown[] = [];
    let confirmed = 0;

    updateHoldGesture("mode", true, 0, state, (value) => countdowns.push(value), () => {
      confirmed += 1;
    });
    updateHoldGesture("mode", true, 1000, state, (value) => countdowns.push(value), () => {
      confirmed += 1;
    });

    expect(confirmed).toBe(1);
    expect(state.rearmBlockedAction).toBe("mode");
  });

  it("confirms wind toggles after one second", () => {
    const state = createHoldState();
    let confirmed = 0;

    updateHoldGesture("wind", true, 0, state, () => undefined, () => {
      confirmed += 1;
    });
    updateHoldGesture("wind", true, 1000, state, () => undefined, () => {
      confirmed += 1;
    });

    expect(confirmed).toBe(1);
  });

  it("keeps clear as a three second hold", () => {
    const state = createHoldState();
    let confirmed = 0;

    updateHoldGesture("clear", true, 0, state, () => undefined, () => {
      confirmed += 1;
    });
    updateHoldGesture("clear", true, 1000, state, () => undefined, () => {
      confirmed += 1;
    });
    updateHoldGesture("clear", true, 3000, state, () => undefined, () => {
      confirmed += 1;
    });

    expect(confirmed).toBe(1);
  });
});
