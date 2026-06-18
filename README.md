# see140

see140 is a local webcam-based gesture drawing site. It uses Next.js, MediaPipe, and Three.js to turn hand movement into a 3D drawing canvas.

Live site: https://li1408.github.io/see140/

## Features

- Black and white visual themes.
- Webcam background.
- Fingertip-based drawing with calibration.
- Two-hand canvas zoom.
- Canvas mode and gravity mode.
- Particle dissolve effect when clearing strokes.
- Opening animation with a full circular loader, click-to-continue handoff, browser-frame reveal, and white page transition.

## Local Start

Use the one-click launcher:

```powershell
.\start-see140.cmd
```

Or start it manually:

```powershell
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:3000/
```

Allow camera access when the browser asks.

## Main Folders

- `src/` - main Next.js app code.
- `public/` - public static assets.
- `startup-animation-prototype/` - standalone native HTML/CSS/JS startup animation prototype.
- `docs/` - notes and supporting documentation.
