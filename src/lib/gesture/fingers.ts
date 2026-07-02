import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

type FingerLandmarks = {
  mcp: number;
  pip: number;
  dip: number;
  tip: number;
};

const WRIST = 0;
const INDEX: FingerLandmarks = { mcp: 5, pip: 6, dip: 7, tip: 8 };
const MIDDLE: FingerLandmarks = { mcp: 9, pip: 10, dip: 11, tip: 12 };
const RING: FingerLandmarks = { mcp: 13, pip: 14, dip: 15, tip: 16 };
const PINKY: FingerLandmarks = { mcp: 17, pip: 18, dip: 19, tip: 20 };

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function angleDegrees(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark
): number {
  const ab = {
    x: a.x - b.x,
    y: a.y - b.y,
    z: (a.z ?? 0) - (b.z ?? 0),
  };
  const cb = {
    x: c.x - b.x,
    y: c.y - b.y,
    z: (c.z ?? 0) - (b.z ?? 0),
  };
  const abLength = Math.hypot(ab.x, ab.y, ab.z);
  const cbLength = Math.hypot(cb.x, cb.y, cb.z);

  if (abLength === 0 || cbLength === 0) {
    return 0;
  }

  const cosine = Math.min(
    Math.max((ab.x * cb.x + ab.y * cb.y + ab.z * cb.z) / (abLength * cbLength), -1),
    1
  );
  return (Math.acos(cosine) * 180) / Math.PI;
}

function isFingerExtended(
  landmarks: NormalizedLandmark[],
  finger: FingerLandmarks,
  palmSize: number
): boolean {
  const wrist = landmarks[WRIST];
  const pip = landmarks[finger.pip];
  const tip = landmarks[finger.tip];
  const angle = angleDegrees(landmarks[finger.mcp], pip, tip);

  return (
    angle >= 155 &&
    distance(wrist, tip) > distance(wrist, pip) + palmSize * 0.18
  );
}

function isFingerCurled(
  landmarks: NormalizedLandmark[],
  finger: FingerLandmarks,
  palmSize: number
): boolean {
  const wrist = landmarks[WRIST];
  const pip = landmarks[finger.pip];
  const tip = landmarks[finger.tip];
  const angle = angleDegrees(landmarks[finger.mcp], pip, tip);

  return (
    angle <= 125 ||
    distance(wrist, tip) <= distance(wrist, pip) + palmSize * 0.08
  );
}

export function isMiddleFingerOnlyGesture(
  landmarks: NormalizedLandmark[]
): boolean {
  if (landmarks.length < 21) {
    return false;
  }

  const palmSize = distance(landmarks[WRIST], landmarks[MIDDLE.mcp]);
  if (palmSize <= 0) {
    return false;
  }

  return (
    isFingerExtended(landmarks, MIDDLE, palmSize) &&
    isFingerCurled(landmarks, INDEX, palmSize) &&
    isFingerCurled(landmarks, RING, palmSize) &&
    isFingerCurled(landmarks, PINKY, palmSize)
  );
}
