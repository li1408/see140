"use client";

import { useRef, useState } from "react";

import { useAppSettings } from "@/hooks/useAppSettings";
import { useThreeScene } from "@/hooks/useThreeScene";
import { useGestureLoop } from "@/hooks/useGestureLoop";
import { StartupIntro } from "@/components/StartupIntro";
import type { CalibrationUiState } from "@/lib/gesture/calibration";
import type {
  BalloonState,
  DrawPoint,
  HoldActionType,
  HoldState,
  PinchReleaseState,
} from "@/lib/types";

export default function Home() {
  const [canvasSize, setCanvasSize] = useState([0, 0]);
  const [holdCountdown, setHoldCountdown] = useState<{
    action: HoldActionType;
    seconds: number;
  } | null>(null);
  const [calibrationResetToken, setCalibrationResetToken] = useState(0);
  const [calibrationState, setCalibrationState] = useState<CalibrationUiState>({
    active: false,
    completed: false,
    stepIndex: 0,
    totalSteps: 0,
    progress: 0,
    target: null,
    pointer: null,
  });
  const [controlsOpen, setControlsOpen] = useState(true);
  const [cameraVisible, setCameraVisible] = useState(true);
  const [introComplete, setIntroComplete] = useState(false);

  const {
    themeMode,
    setThemeMode,
    enableBalloonFall,
    setEnableBalloonFall,
    enableGestureWind,
    setEnableGestureWind,
    enableBalloonFallRef,
    enableGestureWindRef,
    windStateRef,
    windTargetRef,
    waveGestureStateRef,
  } = useAppSettings();

  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkCanvasRef = useRef<HTMLCanvasElement>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);

  const previousDrawPointRef = useRef<DrawPoint>({ x: 0, y: 0 });
  const balloonStateRef = useRef<BalloonState>({
    strokes: [],
    activeStroke: null,
    idSeed: 0,
    tankDepth: 360,
  });
  const holdStateRef = useRef<HoldState>({
    action: null,
    token: 0,
    startedAt: 0,
    pendingLostAt: null,
    lastShownSecond: 0,
    rearmBlockedAction: null,
  });
  const pinchReleaseStateRef = useRef<PinchReleaseState>({ lostAt: null });

  const { threeRef, canvasSizeRef } = useThreeScene({
    containerRef: threeContainerRef,
    themeMode,
    balloonStateRef,
    windStateRef,
    windTargetRef,
    enableBalloonFallRef,
    onResize: (w, h) => setCanvasSize([w, h]),
  });

  useGestureLoop({
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
    calibrationResetToken,
    setHoldCountdown,
    setCalibrationUiState: setCalibrationState,
  });

  const calibrationStep = calibrationState.totalSteps
    ? Math.min(calibrationState.stepIndex + 1, calibrationState.totalSteps)
    : 0;

  return (
    <div className="studio-shell">
      <div ref={threeContainerRef} className="scene-layer" />

      <canvas
        ref={landmarkCanvasRef}
        className="landmark-layer"
        width={canvasSize[0] || 640}
        height={canvasSize[1] || 480}
      />

      <video
        playsInline
        ref={videoRef}
        autoPlay
        muted
        className={`video-background ${cameraVisible ? "" : "is-hidden"}`}
      />

      <header className="studio-topbar">
        <div className="studio-brand" aria-label="see140">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>see140</span>
        </div>

        <div className="top-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => setCameraVisible((value) => !value)}
            aria-pressed={cameraVisible}
          >
            Video
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => setCalibrationResetToken((value) => value + 1)}
          >
            {calibrationState.active
              ? `Align ${calibrationStep}/${calibrationState.totalSteps}`
              : "Align"}
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => setControlsOpen((value) => !value)}
            aria-expanded={controlsOpen}
          >
            Controls
          </button>
        </div>
      </header>

      <aside className={`studio-panel ${controlsOpen ? "is-open" : ""}`}>
        <div className="control-block">
          <span className="control-label">Theme</span>
          <div className="segmented-control">
            <button
              className={themeMode === "dark" ? "is-active" : ""}
              type="button"
              onClick={() => setThemeMode("dark")}
            >
              Black
            </button>
            <button
              className={themeMode === "light" ? "is-active" : ""}
              type="button"
              onClick={() => setThemeMode("light")}
            >
              White
            </button>
          </div>
        </div>

        <div className="control-block">
          <span className="control-label">Mode</span>
          <div className="segmented-control">
            <button
              className={!enableBalloonFall ? "is-active" : ""}
              type="button"
              onClick={() => setEnableBalloonFall(false)}
            >
              Canvas
            </button>
            <button
              className={enableBalloonFall ? "is-active" : ""}
              type="button"
              onClick={() => setEnableBalloonFall(true)}
            >
              Gravity
            </button>
          </div>
        </div>

        <button
          className={`panel-switch ${enableGestureWind ? "is-active" : ""}`}
          type="button"
          onClick={() => setEnableGestureWind((prev) => !prev)}
          disabled={!enableBalloonFall}
          aria-pressed={enableGestureWind}
        >
          <span>Wind</span>
          <span>{enableGestureWind ? "On" : "Off"}</span>
        </button>
      </aside>

      {calibrationState.active && calibrationState.target && (
        <div className="calibration-overlay">
          <div className="calibration-status">
            <span className="calibration-kicker">Alignment</span>
            <span className="calibration-step">
              {calibrationStep} / {calibrationState.totalSteps}
            </span>
          </div>
          <p className="calibration-copy">
            Move your index fingertip onto the ring, then pinch once.
          </p>
          <div
            className="calibration-target"
            style={{
              left: calibrationState.target.x,
              top: calibrationState.target.y,
            }}
            aria-hidden="true"
          >
            <span />
          </div>
          {calibrationState.pointer && (
            <div
              className="calibration-pointer"
              style={{
                left: calibrationState.pointer.x,
                top: calibrationState.pointer.y,
              }}
              aria-hidden="true"
            />
          )}
        </div>
      )}

      {holdCountdown !== null && (
        <div className="hold-overlay">
          <div className="hold-ring" aria-label="Hold gesture countdown">
            <span>{holdCountdown.seconds}</span>
          </div>
          <span className="hold-label">
            {holdCountdown.action === "clear" ? "Clear" : "Confirm"}
          </span>
        </div>
      )}

      {!introComplete && (
        <StartupIntro onComplete={() => setIntroComplete(true)} />
      )}
    </div>
  );
}
