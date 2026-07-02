import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import {
  FilesetResolver,
  GestureRecognizer,
} from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type {
  BalloonState,
  DrawPoint,
  HoldActionType,
  HoldState,
  PinchReleaseState,
  ThreeState,
  WaveGestureState,
  WindVector,
} from "@/lib/types";
import {
  CALIBRATION_CAPTURE_COOLDOWN_MS,
  FIST_GESTURES,
  INDEX_FINGER_TIP_INDEX,
  MAX_VIEW_SCALE,
  MIDDLE_FINGER_MCP_INDEX,
  MIN_VIEW_SCALE,
  MODE_TOGGLE_GESTURES,
  OPEN_PALM_GESTURES,
  PINCH_OFF_RATIO_THRESHOLD,
  PINCH_ON_RATIO_THRESHOLD,
  PINCH_RELEASE_GRACE_MS,
  SMOOTHING_FACTOR,
  THUMB_TIP_INDEX,
  VIEW_SCALE_SMOOTHING,
  WRIST_INDEX,
} from "@/lib/constants";
import { getPinchRatio } from "@/lib/gesture/pinch";
import { updateWindFromWave } from "@/lib/gesture/wind";
import { updateHoldGesture, clearHoldCountdown } from "@/lib/gesture/hold";
import { isMiddleFingerOnlyGesture } from "@/lib/gesture/fingers";
import { drawLandmarks } from "@/lib/gesture/landmarks";
import {
  applyCalibrationTransform,
  getCalibrationTargets,
  solveCalibrationTransform,
  type CalibrationTarget,
  type CalibrationTransform,
  type CalibrationUiState,
} from "@/lib/gesture/calibration";
import {
  addPointToActiveStroke,
  releaseActiveStroke,
  clearAllStrokes,
} from "@/lib/balloon/stroke";

type UseGestureLoopOptions = {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  landmarkCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  canvasSizeRef: MutableRefObject<{ width: number; height: number }>;
  threeRef: MutableRefObject<ThreeState | null>;
  balloonStateRef: MutableRefObject<BalloonState>;
  windTargetRef: MutableRefObject<WindVector>;
  waveGestureStateRef: MutableRefObject<WaveGestureState>;
  holdStateRef: MutableRefObject<HoldState>;
  pinchReleaseStateRef: MutableRefObject<PinchReleaseState>;
  previousDrawPointRef: MutableRefObject<DrawPoint>;
  enableGestureWindRef: MutableRefObject<boolean>;
  windStrengthRef: MutableRefObject<number>;
  calibrationResetToken: number;
  onToggleMode: () => void;
  onToggleWind: () => void;
  setHoldCountdown: (
    value: { action: HoldActionType; seconds: number } | null
  ) => void;
  setCalibrationUiState: (value: CalibrationUiState) => void;
};

type TrackedPinch = {
  active: boolean;
  initialized: boolean;
  ratio: number;
  rawX: number;
  rawY: number;
  x: number;
  y: number;
  z: number;
};

type ZoomState = {
  active: boolean;
  startDistance: number;
  startScale: number;
};

type CalibrationSession = {
  active: boolean;
  completed: boolean;
  stepIndex: number;
  targets: CalibrationTarget[];
  samples: Array<{
    raw: { x: number; y: number };
    screen: { x: number; y: number };
  }>;
  transform: CalibrationTransform | null;
  awaitingRelease: boolean;
  lastCaptureAt: number;
  viewportKey: string;
};

function createTrackedPinch(): TrackedPinch {
  return {
    active: false,
    initialized: false,
    ratio: Number.POSITIVE_INFINITY,
    rawX: 0,
    rawY: 0,
    x: 0,
    y: 0,
    z: 0,
  };
}

function createCalibrationSession(): CalibrationSession {
  return {
    active: false,
    completed: false,
    stepIndex: 0,
    targets: [],
    samples: [],
    transform: null,
    awaitingRelease: false,
    lastCaptureAt: 0,
    viewportKey: "",
  };
}

function buildCalibrationUiState(
  session: CalibrationSession,
  pointer: { x: number; y: number } | null
): CalibrationUiState {
  return {
    active: session.active,
    completed: session.completed,
    stepIndex: session.stepIndex,
    totalSteps: session.targets.length,
    progress:
      session.targets.length === 0
        ? 0
        : Math.min(session.stepIndex / session.targets.length, 1),
    target: session.active ? session.targets[session.stepIndex] ?? null : null,
    pointer,
  };
}

function getViewportKey(width: number, height: number): string {
  return `${width}x${height}`;
}

function resetCalibrationSession(
  session: CalibrationSession,
  width: number,
  height: number
): void {
  session.active = width > 0 && height > 0;
  session.completed = false;
  session.stepIndex = 0;
  session.targets = session.active ? getCalibrationTargets(width, height) : [];
  session.samples = [];
  session.transform = null;
  session.awaitingRelease = false;
  session.lastCaptureAt = 0;
  session.viewportKey = getViewportKey(width, height);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function updateTrackedPinch(
  tracker: TrackedPinch,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  calibrationTransform: CalibrationTransform | null
): TrackedPinch {
  const indexTip = landmarks[INDEX_FINGER_TIP_INDEX];
  const rawX = (1 - indexTip.x) * width;
  const rawY = indexTip.y * height;
  const rawRatio = getPinchRatio(
    landmarks[THUMB_TIP_INDEX],
    indexTip,
    landmarks[WRIST_INDEX],
    landmarks[MIDDLE_FINGER_MCP_INDEX]
  );

  if (!tracker.initialized) {
    tracker.initialized = true;
    tracker.rawX = rawX;
    tracker.rawY = rawY;
    tracker.z = indexTip.z;
    tracker.ratio = rawRatio;
  } else {
    tracker.rawX += (rawX - tracker.rawX) * SMOOTHING_FACTOR;
    tracker.rawY += (rawY - tracker.rawY) * SMOOTHING_FACTOR;
    tracker.z += (indexTip.z - tracker.z) * SMOOTHING_FACTOR;
    tracker.ratio += (rawRatio - tracker.ratio) * 0.4;
  }

  const mappedPoint = applyCalibrationTransform(
    { x: tracker.rawX, y: tracker.rawY },
    calibrationTransform
  );
  tracker.x = clamp(mappedPoint.x, 0, width);
  tracker.y = clamp(mappedPoint.y, 0, height);
  tracker.active = tracker.active
    ? tracker.ratio < PINCH_OFF_RATIO_THRESHOLD
    : tracker.ratio < PINCH_ON_RATIO_THRESHOLD;

  return tracker;
}

function distance(a: TrackedPinch, b: TrackedPinch): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function applyViewScale(three: ThreeState, targetScale: number): void {
  const nextScale = clamp(
    three.viewScale + (targetScale - three.viewScale) * VIEW_SCALE_SMOOTHING,
    MIN_VIEW_SCALE,
    MAX_VIEW_SCALE
  );
  three.viewScale = nextScale;
  three.camera.zoom = nextScale;
  three.camera.updateProjectionMatrix();
}

function resetTrackers(trackers: TrackedPinch[]): void {
  trackers.forEach((tracker) => {
    tracker.active = false;
    tracker.initialized = false;
    tracker.ratio = Number.POSITIVE_INFINITY;
  });
}

function selectPrimaryTracker(trackers: TrackedPinch[]): TrackedPinch | null {
  const initializedTrackers = trackers.filter((tracker) => tracker.initialized);
  if (initializedTrackers.length === 0) {
    return null;
  }

  const activeTrackers = initializedTrackers.filter((tracker) => tracker.active);
  const source = activeTrackers.length > 0 ? activeTrackers : initializedTrackers;
  return source.reduce((best, tracker) =>
    tracker.ratio < best.ratio ? tracker : best
  );
}

function isMediapipeInfoNoise(args: unknown[]): boolean {
  return args.some((arg) => {
    if (typeof arg === "string") {
      return arg.includes("Created TensorFlow Lite XNNPACK delegate for CPU");
    }

    if (arg instanceof Error) {
      return arg.message.includes(
        "Created TensorFlow Lite XNNPACK delegate for CPU"
      );
    }

    return false;
  });
}

export function useGestureLoop({
  videoRef,
  landmarkCanvasRef,
  canvasSizeRef,
  threeRef,
  balloonStateRef,
  windTargetRef,
  waveGestureStateRef,
  holdStateRef,
  pinchReleaseStateRef,
  previousDrawPointRef,
  enableGestureWindRef,
  windStrengthRef,
  calibrationResetToken,
  onToggleMode,
  onToggleWind,
  setHoldCountdown,
  setCalibrationUiState,
}: UseGestureLoopOptions): void {
  const setHoldCountdownRef = useRef(setHoldCountdown);
  const setCalibrationUiStateRef = useRef(setCalibrationUiState);
  const onToggleModeRef = useRef(onToggleMode);
  const onToggleWindRef = useRef(onToggleWind);
  const pinchTrackersRef = useRef<TrackedPinch[]>([
    createTrackedPinch(),
    createTrackedPinch(),
  ]);
  const zoomStateRef = useRef<ZoomState>({
    active: false,
    startDistance: 0,
    startScale: 1,
  });
  const calibrationSessionRef = useRef<CalibrationSession>(
    createCalibrationSession()
  );
  const pendingCalibrationResetRef = useRef(true);

  useEffect(() => {
    setHoldCountdownRef.current = setHoldCountdown;
  }, [setHoldCountdown]);

  useEffect(() => {
    setCalibrationUiStateRef.current = setCalibrationUiState;
  }, [setCalibrationUiState]);

  useEffect(() => {
    onToggleModeRef.current = onToggleMode;
  }, [onToggleMode]);

  useEffect(() => {
    onToggleWindRef.current = onToggleWind;
  }, [onToggleWind]);

  useEffect(() => {
    pendingCalibrationResetRef.current = true;
  }, [calibrationResetToken]);

  useEffect(() => {
    let cancelled = false;
    const originalConsoleError = console.error;
    const filteredConsoleError = (...args: unknown[]) => {
      if (isMediapipeInfoNoise(args)) {
        return;
      }
      originalConsoleError(...args);
    };

    console.error = filteredConsoleError;

    const publishCalibrationUi = (
      pointer: { x: number; y: number } | null
    ) => {
      setCalibrationUiStateRef.current(
        buildCalibrationUiState(calibrationSessionRef.current, pointer)
      );
    };

    const restartCalibration = (width: number, height: number) => {
      resetCalibrationSession(calibrationSessionRef.current, width, height);
      pendingCalibrationResetRef.current = false;
      zoomStateRef.current.active = false;

      const three = threeRef.current;
      if (three && balloonStateRef.current.activeStroke) {
        releaseActiveStroke(
          balloonStateRef.current,
          three.scene,
          pinchReleaseStateRef.current,
          previousDrawPointRef.current
        );
      }

      clearHoldCountdown(holdStateRef.current, setHoldCountdownRef.current);
      holdStateRef.current.rearmBlockedAction = null;
      publishCalibrationUi(null);
    };

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;

        await new Promise<void>((resolve) => {
          video.addEventListener("loadeddata", () => resolve(), { once: true });
        });
        if (cancelled) return;

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
        );
        if (cancelled) return;

        const gestureRecognizer = await GestureRecognizer.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task",
              delegate: "GPU",
            },
            numHands: 2,
            runningMode: "VIDEO",
            minHandDetectionConfidence: 0.58,
            minHandPresenceConfidence: 0.58,
            minTrackingConfidence: 0.58,
          }
        );
        if (cancelled) return;

        const landmarkCanvas = landmarkCanvasRef.current;
        const landmarkCtx = landmarkCanvas?.getContext("2d");

        let lastWebcamTime = -1;

        const renderLoop = () => {
          if (cancelled) return;
          if (!video || !landmarkCanvas || !landmarkCtx) {
            requestAnimationFrame(renderLoop);
            return;
          }

          if (video.currentTime === lastWebcamTime) {
            requestAnimationFrame(renderLoop);
            return;
          }

          lastWebcamTime = video.currentTime;
          const result = gestureRecognizer.recognizeForVideo(
            video,
            video.currentTime * 1000
          );
          const { width, height } = canvasSizeRef.current;

          if (width <= 0 || height <= 0) {
            requestAnimationFrame(renderLoop);
            return;
          }

          if (
            pendingCalibrationResetRef.current ||
            calibrationSessionRef.current.viewportKey !==
              getViewportKey(width, height)
          ) {
            restartCalibration(width, height);
          }

          const calibrationSession = calibrationSessionRef.current;
          landmarkCtx.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);

          if (!result.landmarks || result.landmarks.length === 0) {
            const now = performance.now();
            resetTrackers(pinchTrackersRef.current);
            zoomStateRef.current.active = false;

            if (calibrationSession.active) {
              calibrationSession.awaitingRelease = false;
              publishCalibrationUi(null);
            } else if (balloonStateRef.current.activeStroke) {
              if (pinchReleaseStateRef.current.lostAt === null) {
                pinchReleaseStateRef.current.lostAt = now;
              } else if (
                now - pinchReleaseStateRef.current.lostAt >
                PINCH_RELEASE_GRACE_MS
              ) {
                const three = threeRef.current;
                if (three) {
                  releaseActiveStroke(
                    balloonStateRef.current,
                    three.scene,
                    pinchReleaseStateRef.current,
                    previousDrawPointRef.current
                  );
                }
              }
            }

            waveGestureStateRef.current.active = false;
            clearHoldCountdown(holdStateRef.current, setHoldCountdownRef.current);
            holdStateRef.current.rearmBlockedAction = null;
            requestAnimationFrame(renderLoop);
            return;
          }

          const trackers = pinchTrackersRef.current;
          const visibleHands = result.landmarks.slice(0, 2);
          const trackedHands = visibleHands.map((landmarks, handIndex) =>
            updateTrackedPinch(
              trackers[handIndex],
              landmarks,
              width,
              height,
              calibrationSession.transform
            )
          );

          for (let i = visibleHands.length; i < trackers.length; i++) {
            trackers[i].active = false;
            trackers[i].initialized = false;
          }

          let openPalmDetected = false;
          let fistCount = 0;
          let victoryDetected = false;
          let middleOnlyCount = 0;

          visibleHands.forEach((landmarks, handIndex) => {
            const handGestures = result.gestures?.[handIndex] ?? [];
            const categories = handGestures.map((g) => g.categoryName);
            openPalmDetected =
              openPalmDetected ||
              categories.some((c) => OPEN_PALM_GESTURES.includes(c));
            victoryDetected =
              victoryDetected ||
              categories.some((c) => MODE_TOGGLE_GESTURES.includes(c));
            if (categories.some((c) => FIST_GESTURES.includes(c))) {
              fistCount += 1;
            }
            if (isMiddleFingerOnlyGesture(landmarks)) {
              middleOnlyCount += 1;
            }
            drawLandmarks(
              landmarks,
              landmarkCtx,
              landmarkCanvas.width,
              landmarkCanvas.height,
              trackedHands[handIndex]?.active ?? false
            );
          });

          const activePinches = trackedHands.filter((tracker) => tracker.active);
          const primaryTracker = selectPrimaryTracker(trackedHands);
          const three = threeRef.current;
          const nowMs = performance.now();
          const clearDetected = fistCount >= 2;
          const windToggleDetected = middleOnlyCount >= 2;
          const modeToggleDetected =
            victoryDetected && !clearDetected && !windToggleDetected;

          if (calibrationSession.active) {
            if (primaryTracker?.active) {
              if (
                !calibrationSession.awaitingRelease &&
                nowMs - calibrationSession.lastCaptureAt >=
                  CALIBRATION_CAPTURE_COOLDOWN_MS
              ) {
                const target =
                  calibrationSession.targets[calibrationSession.stepIndex];
                if (target) {
                  calibrationSession.samples.push({
                    raw: {
                      x: primaryTracker.rawX,
                      y: primaryTracker.rawY,
                    },
                    screen: {
                      x: target.x,
                      y: target.y,
                    },
                  });
                  calibrationSession.stepIndex += 1;
                  calibrationSession.awaitingRelease = true;
                  calibrationSession.lastCaptureAt = nowMs;

                  if (
                    calibrationSession.stepIndex >=
                    calibrationSession.targets.length
                  ) {
                    const transform = solveCalibrationTransform(
                      calibrationSession.samples
                    );
                    if (transform) {
                      calibrationSession.transform = transform;
                      calibrationSession.active = false;
                      calibrationSession.completed = true;
                    } else {
                      resetCalibrationSession(calibrationSession, width, height);
                    }
                  }
                }
              }
            } else {
              calibrationSession.awaitingRelease = false;
            }

            if (!primaryTracker?.active) {
              calibrationSession.awaitingRelease = false;
            }

            publishCalibrationUi(
              primaryTracker
                ? { x: primaryTracker.x, y: primaryTracker.y }
                : null
            );
            waveGestureStateRef.current.active = false;
            clearHoldCountdown(holdStateRef.current, setHoldCountdownRef.current);
            holdStateRef.current.rearmBlockedAction = null;
            requestAnimationFrame(renderLoop);
            return;
          }

          const zooming = activePinches.length >= 2;

          if (zooming && three) {
            if (balloonStateRef.current.activeStroke) {
              releaseActiveStroke(
                balloonStateRef.current,
                three.scene,
                pinchReleaseStateRef.current,
                previousDrawPointRef.current
              );
            }

            const currentDistance = distance(activePinches[0], activePinches[1]);
            if (currentDistance > 16) {
              const zoomState = zoomStateRef.current;
              if (!zoomState.active) {
                zoomState.active = true;
                zoomState.startDistance = currentDistance;
                zoomState.startScale = three.viewScale;
              } else {
                const targetScale =
                  zoomState.startScale *
                  (currentDistance / Math.max(zoomState.startDistance, 16));
                applyViewScale(three, targetScale);
              }
            }
          } else {
            zoomStateRef.current.active = false;
            const drawHand = activePinches[0];
            const canDraw = Boolean(drawHand) && !clearDetected;

            if (canDraw && drawHand && three) {
              if (
                previousDrawPointRef.current.x === 0 &&
                previousDrawPointRef.current.y === 0
              ) {
                previousDrawPointRef.current.x = drawHand.x;
                previousDrawPointRef.current.y = drawHand.y;
              }

              const smoothedX =
                previousDrawPointRef.current.x +
                SMOOTHING_FACTOR * (drawHand.x - previousDrawPointRef.current.x);
              const smoothedY =
                previousDrawPointRef.current.y +
                SMOOTHING_FACTOR * (drawHand.y - previousDrawPointRef.current.y);

              addPointToActiveStroke(
                smoothedX,
                smoothedY,
                three,
                canvasSizeRef.current,
                balloonStateRef.current
              );
              previousDrawPointRef.current.x = smoothedX;
              previousDrawPointRef.current.y = smoothedY;
              pinchReleaseStateRef.current.lostAt = null;
            } else if (balloonStateRef.current.activeStroke) {
              if (pinchReleaseStateRef.current.lostAt === null) {
                pinchReleaseStateRef.current.lostAt = nowMs;
              } else if (
                nowMs - pinchReleaseStateRef.current.lostAt >
                PINCH_RELEASE_GRACE_MS
              ) {
                if (three) {
                  releaseActiveStroke(
                    balloonStateRef.current,
                    three.scene,
                    pinchReleaseStateRef.current,
                    previousDrawPointRef.current
                  );
                }
              }
            }
          }

          if (enableGestureWindRef.current && openPalmDetected && !zooming) {
            const hand = result.landmarks[0];
            const wrist = hand?.[0];
            if (wrist) {
              const wristX = (1 - wrist.x) * width;
              const wristY = wrist.y * height;
              updateWindFromWave(
                wristX,
                wristY,
                wrist.z,
                width,
                height,
                waveGestureStateRef.current,
                windTargetRef.current,
                nowMs,
                windStrengthRef.current
              );
            }
          } else {
            waveGestureStateRef.current.active = false;
          }

          updateHoldGesture(
            "clear",
            clearDetected,
            nowMs,
            holdStateRef.current,
            setHoldCountdownRef.current,
            () => {
              const activeThree = threeRef.current;
              if (activeThree) {
                clearAllStrokes(
                  balloonStateRef.current,
                  activeThree,
                  pinchReleaseStateRef.current,
                  previousDrawPointRef.current
                );
              }
            }
          );

          updateHoldGesture(
            "wind",
            windToggleDetected && !clearDetected,
            nowMs,
            holdStateRef.current,
            setHoldCountdownRef.current,
            () => onToggleWindRef.current()
          );

          updateHoldGesture(
            "mode",
            modeToggleDetected,
            nowMs,
            holdStateRef.current,
            setHoldCountdownRef.current,
            () => onToggleModeRef.current()
          );

          requestAnimationFrame(renderLoop);
        };

        renderLoop();
      } catch (error) {
        console.error("Failed to start gesture recognition.", error);
      }
    };

    start();

    const capturedVideoRef = videoRef;
    const capturedHoldStateRef = holdStateRef;
    return () => {
      cancelled = true;
      if (console.error === filteredConsoleError) {
        console.error = originalConsoleError;
      }
      const video = capturedVideoRef.current;
      const stream = video?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      clearHoldCountdown(capturedHoldStateRef.current, setHoldCountdownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
