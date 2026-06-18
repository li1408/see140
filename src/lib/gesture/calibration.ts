export type CalibrationPoint = {
  x: number;
  y: number;
};

export type CalibrationTarget = CalibrationPoint & {
  id: string;
  label: string;
  radius: number;
};

export type CalibrationSample = {
  raw: CalibrationPoint;
  screen: CalibrationPoint;
};

export type CalibrationTransform = {
  ax: number;
  bx: number;
  cx: number;
  ay: number;
  by: number;
  cy: number;
};

export type CalibrationUiState = {
  active: boolean;
  completed: boolean;
  stepIndex: number;
  totalSteps: number;
  progress: number;
  target: CalibrationTarget | null;
  pointer: CalibrationPoint | null;
};

export function getCalibrationTargets(
  width: number,
  height: number
): CalibrationTarget[] {
  const marginX = Math.min(108, width * 0.14);
  const marginY = Math.min(92, height * 0.14);
  const radius = Math.max(36, Math.min(width, height) * 0.052);

  return [
    {
      id: "center",
      label: "Center",
      x: width / 2,
      y: height / 2,
      radius,
    },
    {
      id: "top-left",
      label: "Top Left",
      x: marginX,
      y: marginY,
      radius,
    },
    {
      id: "top-right",
      label: "Top Right",
      x: width - marginX,
      y: marginY,
      radius,
    },
    {
      id: "bottom-left",
      label: "Bottom Left",
      x: marginX,
      y: height - marginY,
      radius,
    },
    {
      id: "bottom-right",
      label: "Bottom Right",
      x: width - marginX,
      y: height - marginY,
      radius,
    },
  ];
}

export function applyCalibrationTransform(
  point: CalibrationPoint,
  transform: CalibrationTransform | null
): CalibrationPoint {
  if (!transform) {
    return point;
  }

  return {
    x: transform.ax * point.x + transform.bx * point.y + transform.cx,
    y: transform.ay * point.x + transform.by * point.y + transform.cy,
  };
}

export function solveCalibrationTransform(
  samples: CalibrationSample[]
): CalibrationTransform | null {
  if (samples.length < 3) {
    return null;
  }

  let sumX2 = 0;
  let sumY2 = 0;
  let sumXY = 0;
  let sumX = 0;
  let sumY = 0;
  let sumU = 0;
  let sumV = 0;
  let sumXU = 0;
  let sumYU = 0;
  let sumXV = 0;
  let sumYV = 0;

  for (const sample of samples) {
    const x = sample.raw.x;
    const y = sample.raw.y;
    const u = sample.screen.x;
    const v = sample.screen.y;

    sumX2 += x * x;
    sumY2 += y * y;
    sumXY += x * y;
    sumX += x;
    sumY += y;
    sumU += u;
    sumV += v;
    sumXU += x * u;
    sumYU += y * u;
    sumXV += x * v;
    sumYV += y * v;
  }

  const normalMatrix = [
    [sumX2, sumXY, sumX],
    [sumXY, sumY2, sumY],
    [sumX, sumY, samples.length],
  ];

  const xSolution = solveLinear3x3(normalMatrix, [sumXU, sumYU, sumU]);
  const ySolution = solveLinear3x3(normalMatrix, [sumXV, sumYV, sumV]);

  if (!xSolution || !ySolution) {
    return null;
  }

  return {
    ax: xSolution[0],
    bx: xSolution[1],
    cx: xSolution[2],
    ay: ySolution[0],
    by: ySolution[1],
    cy: ySolution[2],
  };
}

function solveLinear3x3(
  matrix: number[][],
  vector: number[]
): [number, number, number] | null {
  const a = matrix.map((row) => [...row]);
  const b = [...vector];

  for (let col = 0; col < 3; col += 1) {
    let pivotRow = col;
    for (let row = col + 1; row < 3; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivotRow][col])) {
        pivotRow = row;
      }
    }

    if (Math.abs(a[pivotRow][col]) < 1e-8) {
      return null;
    }

    if (pivotRow !== col) {
      [a[col], a[pivotRow]] = [a[pivotRow], a[col]];
      [b[col], b[pivotRow]] = [b[pivotRow], b[col]];
    }

    const pivot = a[col][col];
    for (let current = col; current < 3; current += 1) {
      a[col][current] /= pivot;
    }
    b[col] /= pivot;

    for (let row = 0; row < 3; row += 1) {
      if (row === col) {
        continue;
      }
      const factor = a[row][col];
      for (let current = col; current < 3; current += 1) {
        a[row][current] -= factor * a[col][current];
      }
      b[row] -= factor * b[col];
    }
  }

  return [b[0], b[1], b[2]];
}
