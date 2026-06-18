"use client";

import type { AnimationEvent } from "react";
import { useState } from "react";

type StartupIntroProps = {
  onComplete: () => void;
};

export function StartupIntro({ onComplete }: StartupIntroProps) {
  const [ringComplete, setRingComplete] = useState(false);
  const [handoffStarted, setHandoffStarted] = useState(false);

  const canContinue = ringComplete && !handoffStarted;

  const startHandoff = () => {
    if (!canContinue) {
      return;
    }

    setHandoffStarted(true);
  };

  const handleRootAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.animationName === "startup-overlay-exit") {
      onComplete();
    }
  };

  return (
    <div
      className={`startup-intro ${ringComplete ? "is-ready" : ""} ${
        handoffStarted ? "is-handoff" : ""
      }`}
      onClick={startHandoff}
      onAnimationEnd={handleRootAnimationEnd}
    >
      <section className="startup-loader-stage" aria-label="正在加载">
        <div className="startup-loader-mark">
          <span className="startup-loader-glow" aria-hidden="true" />
          <svg
            className="startup-loader-ring"
            viewBox="0 0 64 64"
            aria-hidden="true"
          >
            <circle className="startup-ring-track" cx="32" cy="32" r="25" />
            <circle
              className="startup-ring-progress"
              cx="32"
              cy="32"
              r="25"
              onAnimationEnd={() => setRingComplete(true)}
            />
            <circle className="startup-ring-complete" cx="32" cy="32" r="25" />
          </svg>
          <span className="startup-loader-dot" aria-hidden="true" />
        </div>
        <button
          className="startup-continue"
          type="button"
          disabled={!canContinue}
          tabIndex={canContinue ? 0 : -1}
          onClick={(event) => {
            event.stopPropagation();
            startHandoff();
          }}
        >
          点击继续
        </button>
      </section>

      <section className="startup-browser-frame" aria-label="Opening preview">
        <div className="startup-browser-bar" aria-hidden="true">
          <div className="startup-window-dots">
            <span />
            <span />
            <span />
          </div>
          <div className="startup-address-line" />
        </div>
        <div className="startup-browser-viewport">
          <div className="startup-black-preview" aria-hidden="true" />
          <div className="startup-white-wipe" aria-hidden="true" />
          <div className="startup-site-skeleton" aria-hidden="true">
            <div className="startup-skeleton-header">
              <span />
              <span />
            </div>
            <div className="startup-skeleton-hero">
              <span />
              <span />
              <span />
            </div>
            <div className="startup-skeleton-grid">
              <span />
              <span />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
