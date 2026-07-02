import { describe, expect, it } from "vitest";
import { isMiddleFingerOnlyGesture } from "@/lib/gesture/fingers";

const landmark = (x: number, y: number, z = 0) => ({ x, y, z });

function baseHand() {
  return Array.from({ length: 21 }, () => landmark(0, 0));
}

function setFinger(
  landmarks: ReturnType<typeof baseHand>,
  indices: [number, number, number, number],
  points: Array<{ x: number; y: number }>
) {
  indices.forEach((index, pointIndex) => {
    landmarks[index] = landmark(points[pointIndex].x, points[pointIndex].y);
  });
}

function middleOnlyHand() {
  const hand = baseHand();
  hand[0] = landmark(0, 0);

  setFinger(hand, [5, 6, 7, 8], [
    { x: -0.18, y: -0.36 },
    { x: -0.24, y: -0.48 },
    { x: -0.18, y: -0.30 },
    { x: -0.08, y: -0.20 },
  ]);
  setFinger(hand, [9, 10, 11, 12], [
    { x: 0, y: -0.42 },
    { x: 0, y: -0.72 },
    { x: 0, y: -0.98 },
    { x: 0, y: -1.24 },
  ]);
  setFinger(hand, [13, 14, 15, 16], [
    { x: 0.16, y: -0.34 },
    { x: 0.22, y: -0.45 },
    { x: 0.17, y: -0.29 },
    { x: 0.08, y: -0.18 },
  ]);
  setFinger(hand, [17, 18, 19, 20], [
    { x: 0.30, y: -0.26 },
    { x: 0.34, y: -0.35 },
    { x: 0.28, y: -0.22 },
    { x: 0.18, y: -0.13 },
  ]);

  return hand;
}

describe("isMiddleFingerOnlyGesture", () => {
  it("returns true when only the middle finger is extended", () => {
    expect(isMiddleFingerOnlyGesture(middleOnlyHand())).toBe(true);
  });

  it("returns false when the index finger is also extended", () => {
    const hand = middleOnlyHand();
    setFinger(hand, [5, 6, 7, 8], [
      { x: -0.16, y: -0.38 },
      { x: -0.18, y: -0.66 },
      { x: -0.19, y: -0.90 },
      { x: -0.20, y: -1.12 },
    ]);

    expect(isMiddleFingerOnlyGesture(hand)).toBe(false);
  });

  it("returns false when the middle finger is curled", () => {
    const hand = middleOnlyHand();
    setFinger(hand, [9, 10, 11, 12], [
      { x: 0, y: -0.42 },
      { x: 0.04, y: -0.58 },
      { x: 0.02, y: -0.36 },
      { x: -0.04, y: -0.24 },
    ]);

    expect(isMiddleFingerOnlyGesture(hand)).toBe(false);
  });
});
