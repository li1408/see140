const replayButton = document.querySelector(".replay-button");
const app = document.querySelector(".intro-app");

// GSAP is loaded from CDN in index.html. This guard keeps the page readable if
// the CDN is blocked while still making the missing dependency obvious.
if (!window.gsap) {
  console.warn("GSAP did not load. Check your network connection.");
} else {
  const gsap = window.gsap;
  let timeline;
  let waitingForClick = false;
  let ringComplete = false;

  function setInitialState() {
    waitingForClick = false;
    ringComplete = false;
    app.classList.remove("is-awaiting-click");

    gsap.set(".loader-stage", {
      autoAlpha: 1,
      scale: 1,
    });

    gsap.set(".loader-dot", {
      autoAlpha: 1,
      scale: 1,
      boxShadow: "0 0 18px rgba(255,255,255,0.38)",
    });

    gsap.set(".loader-glow", {
      autoAlpha: 0.42,
      scale: 1,
    });

    gsap.set(".loader-ring", {
      autoAlpha: 0,
      rotate: -90,
      scale: 0.86,
    });

    gsap.set(".ring-progress", {
      autoAlpha: 1,
      strokeDashoffset: 157,
    });

    gsap.set(".ring-complete", {
      autoAlpha: 0,
    });

    gsap.set(".continue-hint", {
      autoAlpha: 0,
      y: 8,
    });

    gsap.set(".browser-frame", {
      autoAlpha: 0,
      scale: 0.74,
      clipPath: "inset(49% 49% 49% 49% round 20px)",
      y: 10,
    });

    gsap.set(".browser-bar", {
      autoAlpha: 0,
      y: -10,
    });

    gsap.set(".black-preview", {
      autoAlpha: 1,
    });

    gsap.set(".white-wipe", {
      scaleY: 0,
      transformOrigin: "bottom center",
    });

    gsap.set(".site-content", {
      autoAlpha: 0,
    });

    gsap.set(
      [
        ".content-header",
        ".eyebrow",
        ".hero-placeholder h1",
        ".hero-copy",
        ".hero-actions",
        ".image-placeholder",
        ".placeholder-card",
      ],
      {
        autoAlpha: 0,
        y: 18,
      }
    );

    gsap.set(".replay-button", {
      autoAlpha: 0,
      y: 8,
    });
  }

  function buildTimeline() {
    if (timeline) {
      timeline.kill();
    }

    setInitialState();

    timeline = gsap.timeline({
      defaults: {
        ease: "power3.out",
      },
    });

    // 1. Black opening: a restrained breathing dot.
    timeline
      .to(".loader-dot", {
        scale: 1.34,
        autoAlpha: 0.68,
        boxShadow: "0 0 34px rgba(255,255,255,0.56)",
        duration: 0.62,
        ease: "sine.inOut",
        yoyo: true,
        repeat: 1,
      })
      .to(
        ".loader-glow",
        {
          scale: 2.2,
          autoAlpha: 0.12,
          duration: 1.24,
          ease: "sine.inOut",
        },
        0
      );

    // 2. Loading ring: it turns most of the way, briefly hesitates, then fills.
    // The click gate is deliberately set only after the ring reaches 100%.
    timeline
      .to(".loader-ring", {
        autoAlpha: 1,
        scale: 1,
        duration: 0.55,
      })
      .to(
        ".ring-progress",
        {
          strokeDashoffset: 28,
          duration: 1,
          ease: "power3.inOut",
        },
        "<"
      )
      .to(
        ".loader-ring",
        {
          rotate: 196,
          duration: 1,
          ease: "none",
        },
        "<"
      )
      // A real pause: the ring stays near-complete but does not accept clicks.
      .to({}, { duration: 0.42 })
      .to(
        ".ring-progress",
        {
          strokeDashoffset: 0,
          duration: 0.64,
          ease: "power2.out",
        },
        "+=0.08"
      )
      .to(
        ".loader-ring",
        {
          rotate: 270,
          duration: 0.64,
          ease: "power2.out",
        },
        "<"
      )
      .to(".loader-dot", {
        scale: 1.16,
        duration: 0.22,
        ease: "sine.inOut",
        yoyo: true,
        repeat: 1,
      })
      .add(() => {
        gsap.set(".ring-complete", { autoAlpha: 1 });
        gsap.set(".ring-progress", { autoAlpha: 0 });
        ringComplete = true;
      })
      .to(".continue-hint", {
        autoAlpha: 1,
        y: 0,
        duration: 0.45,
      })
      .add(() => {
        waitingForClick = true;
        app.classList.add("is-awaiting-click");
        timeline.pause();
      });

    // 3. Browser window unfolds from the center after the user's click.
    timeline
      .to(".continue-hint", {
        autoAlpha: 0,
        y: -6,
        duration: 0.28,
      })
      .to(
        ".loader-stage",
        {
          autoAlpha: 0,
          scale: 0.86,
          duration: 0.55,
        },
        "-=0.05"
      )
      .to(
        ".browser-frame",
        {
          autoAlpha: 1,
          scale: 1,
          clipPath: "inset(0% 0% 0% 0% round 20px)",
          y: 0,
          duration: 1,
          ease: "expo.out",
        },
        "<"
      )
      .to(
        ".browser-bar",
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.52,
        },
        "-=0.5"
      );

    // 4. White page transition fills the browser viewport from bottom to top.
    timeline
      .to(".white-wipe", {
        scaleY: 1,
        duration: 1,
        ease: "power4.inOut",
      })
      .to(
        ".black-preview",
        {
          autoAlpha: 0,
          duration: 0.35,
        },
        "-=0.2"
      );

    // 5. Placeholder site content reveals in small, staggered layers.
    timeline
      .to(
        ".site-content",
        {
          autoAlpha: 1,
          duration: 0.2,
        },
        "-=0.15"
      )
      .to(
        [
          ".content-header",
          ".eyebrow",
          ".hero-placeholder h1",
          ".hero-copy",
          ".hero-actions",
          ".image-placeholder",
          ".placeholder-card",
        ],
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.82,
          stagger: 0.07,
        },
        "-=0.05"
      )
      .fromTo(
        ".replay-button",
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.45 },
        "-=0.25"
      );

    return timeline;
  }

  function replayAnimation() {
    buildTimeline().play(0);
  }

  function continueAfterClick() {
    if (!ringComplete || !waitingForClick || !timeline) {
      return;
    }

    waitingForClick = false;
    app.classList.remove("is-awaiting-click");
    timeline.play();
  }

  window.addEventListener("load", replayAnimation);
  window.addEventListener("click", continueAfterClick);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      continueAfterClick();
    }
  });

  replayButton.addEventListener("click", (event) => {
    event.stopPropagation();
    replayAnimation();
  });
}
