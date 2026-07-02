import type { HoldActionType, HoldState } from "../types";
import {
  GESTURE_HOLD_CONFIRM_MS,
  GESTURE_HOLD_JITTER_GRACE_MS,
  TOGGLE_GESTURE_HOLD_CONFIRM_MS,
} from "../constants";

type SetHoldCountdown = (
  value: { action: HoldActionType; seconds: number } | null
) => void;

function getHoldConfirmMs(action: HoldActionType): number {
  return action === "clear"
    ? GESTURE_HOLD_CONFIRM_MS
    : TOGGLE_GESTURE_HOLD_CONFIRM_MS;
}

function getInitialHoldSecond(action: HoldActionType): number {
  return Math.ceil(getHoldConfirmMs(action) / 1000);
}

export function clearHoldCountdown(
  holdState: HoldState,
  setHoldCountdown: SetHoldCountdown
): void {
  holdState.action = null;
  holdState.pendingLostAt = null;
  holdState.lastShownSecond = 0;
  setHoldCountdown(null);
}

export function updateHoldGesture(
  action: HoldActionType,
  isDetected: boolean,
  nowMs: number,
  holdState: HoldState,
  setHoldCountdown: SetHoldCountdown,
  onConfirm: () => void
): void {
  if (holdState.rearmBlockedAction === action) {
    if (!isDetected) {
      holdState.rearmBlockedAction = null;
    }
    return;
  }

  if (holdState.action === action) {
    if (isDetected) {
      holdState.pendingLostAt = null;
    } else if (!holdState.pendingLostAt) {
      holdState.pendingLostAt = nowMs;
    } else if (nowMs - holdState.pendingLostAt > GESTURE_HOLD_JITTER_GRACE_MS) {
      clearHoldCountdown(holdState, setHoldCountdown);
      return;
    }

    const elapsed = nowMs - holdState.startedAt;
    const confirmMs = getHoldConfirmMs(action);
    const remainSeconds = Math.max(
      1,
      Math.ceil((confirmMs - elapsed) / 1000)
    );
    if (holdState.lastShownSecond !== remainSeconds) {
      holdState.lastShownSecond = remainSeconds;
      setHoldCountdown({ action, seconds: remainSeconds });
    }

    if (elapsed >= confirmMs) {
      holdState.rearmBlockedAction = action;
      clearHoldCountdown(holdState, setHoldCountdown);
      onConfirm();
    }
    return;
  }

  if (!isDetected) {
    return;
  }

  clearHoldCountdown(holdState, setHoldCountdown);
  holdState.action = action;
  holdState.token += 1;
  holdState.startedAt = nowMs;
  holdState.pendingLostAt = null;
  holdState.lastShownSecond = getInitialHoldSecond(action);
  setHoldCountdown({ action, seconds: getInitialHoldSecond(action) });
}
