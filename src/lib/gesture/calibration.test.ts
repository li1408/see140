import { describe, expect, it } from "vitest";

import {
  applyCalibrationTransform,
  solveCalibrationTransform,
  type CalibrationSample,
} from "@/lib/gesture/calibration";

describe("solveCalibrationTransform", () => {
  it("solves an affine transform from raw points to screen points", () => {
    const samples: CalibrationSample[] = [
      { raw: { x: 10, y: 10 }, screen: { x: 100, y: 120 } },
      { raw: { x: 110, y: 10 }, screen: { x: 300, y: 120 } },
      { raw: { x: 10, y: 90 }, screen: { x: 100, y: 280 } },
      { raw: { x: 110, y: 90 }, screen: { x: 300, y: 280 } },
      { raw: { x: 60, y: 50 }, screen: { x: 200, y: 200 } },
    ];

    const transform = solveCalibrationTransform(samples);
    expect(transform).not.toBeNull();

    const mapped = applyCalibrationTransform({ x: 60, y: 50 }, transform);
    expect(mapped.x).toBeCloseTo(200, 4);
    expect(mapped.y).toBeCloseTo(200, 4);
  });
});
