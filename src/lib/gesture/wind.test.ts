import { describe, expect, it } from "vitest";
import { updateWindFromWave } from "@/lib/gesture/wind";
import type { WaveGestureState, WindVector } from "@/lib/types";

function createWaveState(): WaveGestureState {
  return {
    active: false,
    lastX: 0,
    lastY: 0,
    lastZ: 0,
    lastTime: 0,
  };
}

function createWindTarget(): WindVector {
  return { x: 0, y: 0, z: 0 };
}

describe("updateWindFromWave", () => {
  it("creates steady wind from palm position even without a waving motion", () => {
    const waveState = createWaveState();
    const windTarget = createWindTarget();

    updateWindFromWave(160, 360, 0, 1280, 720, waveState, windTarget, 0, 1);

    expect(windTarget.x).toBeGreaterThan(0);
  });

  it("uses palm position as wind origin direction", () => {
    const leftTarget = createWindTarget();
    const rightTarget = createWindTarget();

    updateWindFromWave(160, 360, 0, 1280, 720, createWaveState(), leftTarget, 0, 1);
    updateWindFromWave(1120, 360, 0, 1280, 720, createWaveState(), rightTarget, 0, 1);

    expect(leftTarget.x).toBeGreaterThan(0);
    expect(rightTarget.x).toBeLessThan(0);
  });

  it("scales wind with the UI strength value", () => {
    const weakTarget = createWindTarget();
    const strongTarget = createWindTarget();

    updateWindFromWave(160, 360, 0, 1280, 720, createWaveState(), weakTarget, 0, 0.8);
    updateWindFromWave(160, 360, 0, 1280, 720, createWaveState(), strongTarget, 0, 3.2);

    expect(strongTarget.x).toBeGreaterThan(weakTarget.x * 2);
  });
});
