import type { WindVector, WaveGestureState } from "../types";
import {
  SCALED_MAX_GESTURE_WIND,
  SCALED_MAX_GESTURE_WIND_DELTA,
  SCALED_GESTURE_WAVE_TO_WIND,
  SCALED_MAX_GESTURE_VERTICAL_WIND,
  SCALED_MAX_GESTURE_VERTICAL_WIND_DELTA,
  SCALED_MAX_GESTURE_DEPTH_WIND,
  SCALED_MAX_GESTURE_DEPTH_WIND_DELTA,
} from "../constants";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function updateWindFromWave(
  wristX: number,
  wristY: number,
  wristZ: number,
  canvasWidth: number,
  canvasHeight: number,
  waveState: WaveGestureState,
  windTarget: WindVector,
  now: number,
  windStrength = 1
): void {
  const strength = clamp(windStrength, 0.4, 4);
  const maxWindX = SCALED_MAX_GESTURE_WIND * strength;
  const maxWindY = SCALED_MAX_GESTURE_VERTICAL_WIND * strength;
  const maxWindZ = SCALED_MAX_GESTURE_DEPTH_WIND * strength;
  const normalizedX = clamp((wristX - canvasWidth / 2) / (canvasWidth / 2), -1, 1);
  const normalizedY = clamp((wristY - canvasHeight / 2) / (canvasHeight / 2), -1, 1);
  const normalizedZ = clamp(wristZ * 2, -1, 1);
  const poseWind = {
    // Wind originates from the palm side: left palm pushes right, right palm pushes left.
    x: -normalizedX * maxWindX * 0.92,
    y: -normalizedY * maxWindY * 0.5,
    z: -normalizedZ * maxWindZ * 0.46,
  };

  let windPulseX = 0;
  let windPulseY = 0;
  let windPulseZ = 0;

  if (!waveState.active) {
    waveState.active = true;
    waveState.lastX = wristX;
    waveState.lastY = wristY;
    waveState.lastZ = wristZ;
    waveState.lastTime = now;
  } else {
    const deltaX = wristX - waveState.lastX;
    const deltaY = wristY - waveState.lastY;
    const deltaZ = wristZ - waveState.lastZ;
    const deltaTime = (now - waveState.lastTime) / 1000;

    if (deltaTime > 0) {
      const speedX = deltaX / deltaTime;
      const speedY = deltaY / deltaTime;
      const speedZ = deltaZ / deltaTime;

      windPulseX =
        Math.sign(speedX) *
        Math.min(
          SCALED_MAX_GESTURE_WIND_DELTA * strength,
          Math.abs(speedX) * SCALED_GESTURE_WAVE_TO_WIND * strength
        );
      windPulseY =
        -Math.sign(speedY) *
        Math.min(
          SCALED_MAX_GESTURE_VERTICAL_WIND_DELTA * strength,
          Math.abs(speedY) * SCALED_GESTURE_WAVE_TO_WIND * strength
        );
      windPulseZ =
        -Math.sign(speedZ) *
        Math.min(
          SCALED_MAX_GESTURE_DEPTH_WIND_DELTA * strength,
          Math.abs(speedZ) * SCALED_GESTURE_WAVE_TO_WIND * strength
        );
    }
  }

  waveState.lastX = wristX;
  waveState.lastY = wristY;
  waveState.lastZ = wristZ;
  waveState.lastTime = now;

  windTarget.x = clamp(poseWind.x + windPulseX, -maxWindX, maxWindX);
  windTarget.y = clamp(poseWind.y + windPulseY, -maxWindY, maxWindY);
  windTarget.z = clamp(poseWind.z + windPulseZ, -maxWindZ, maxWindZ);
}
