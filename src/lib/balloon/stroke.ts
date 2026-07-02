import * as THREE from "three";
import type { BalloonState, ThreeState, PinchReleaseState, DrawPoint, BalloonStroke } from "../types";
import {
  CLEAR_PARTICLE_GRAVITY,
  CLEAR_PARTICLE_LIFETIME_MS,
  CLEAR_PARTICLES_PER_POINT,
  CLEAR_PARTICLE_SAMPLE_STEP,
  CLEAR_PARTICLE_SIZE,
  CLEAR_PARTICLE_SPREAD,
  DRAW_PLANE_Z,
  SMOOTHING_FACTOR,
  MIN_POINTS_FOR_BALLOON,
  MIN_POINT_DISTANCE,
  DRAWING_ANIMATION_PERIOD,
  DRAWING_ANIMATION_AMPLITUDE,
  END_CAP_PROTRUSION,
  END_CAP_WIDTH_SEGMENTS,
  END_CAP_HEIGHT_SEGMENTS,
  SWAY_STRENGTH,
  BALLOON_DEFAULT_RADIUS,
  BALLOON_RADIUS_VARIANCE,
} from "../constants";
import {
  randomBalloonColor,
  rebuildBalloonGeometry,
  clampInsideTank,
} from "./geometry";
import { screenPointToWorldOnPlane } from "../three/projection";

export function addPointToActiveStroke(
  x: number,
  y: number,
  three: ThreeState,
  canvasSize: { width: number; height: number },
  balloonState: BalloonState
): void {
  const point = screenPointToWorldOnPlane(
    x,
    y,
    canvasSize,
    three.camera,
    DRAW_PLANE_Z,
    new THREE.Vector3()
  );
  clampInsideTank(point, three);

  if (!balloonState.activeStroke) {
    const color = randomBalloonColor();
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.2,
      metalness: 0.25,
      emissive: color.clone().multiplyScalar(0.08),
    });
    const starterCurve = new THREE.CatmullRomCurve3([
      point.clone(),
      point.clone().add(new THREE.Vector3(1, 1, 0)),
    ]);
    const starterGeometry = new THREE.TubeGeometry(starterCurve, 8, BALLOON_DEFAULT_RADIUS, 12, false);
    const mesh = new THREE.Mesh(starterGeometry, material);
    const startCap = new THREE.Mesh(
      new THREE.SphereGeometry(
        BALLOON_DEFAULT_RADIUS * END_CAP_PROTRUSION,
        END_CAP_WIDTH_SEGMENTS,
        END_CAP_HEIGHT_SEGMENTS
      ),
      material
    );
    const endCap = new THREE.Mesh(
      new THREE.SphereGeometry(
        BALLOON_DEFAULT_RADIUS * END_CAP_PROTRUSION,
        END_CAP_WIDTH_SEGMENTS,
        END_CAP_HEIGHT_SEGMENTS
      ),
      material
    );
    startCap.position.copy(point);
    endCap.position.copy(point);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    startCap.castShadow = true;
    startCap.receiveShadow = true;
    endCap.castShadow = true;
    endCap.receiveShadow = true;

    three.scene.add(mesh);
    three.scene.add(startCap);
    three.scene.add(endCap);

    balloonState.activeStroke = {
      id: ++balloonState.idSeed,
      points: [point],
      mesh,
      startCap,
      endCap,
      color,
      velocityY: 0,
      settled: false,
      bounce: 1,
      baseRadius: BALLOON_DEFAULT_RADIUS + Math.random() * BALLOON_RADIUS_VARIANCE,
      minY: point.y,
      maxY: point.y,
      velocityX: (Math.random() - 0.5) * 8,
      velocityZ: (Math.random() - 0.5) * 8,
      swayPhase: Math.random() * Math.PI * 2,
      swayStrength: SWAY_STRENGTH * (0.7 + Math.random() * 0.6),
      angularVelocity: 0,
      tiltAxis: new THREE.Vector3(1, 0, 0),
      contactPivot: new THREE.Vector3(point.x, point.y, point.z),
      landed: false,
      toppling: false,
      settleFrames: 0,
    };
    balloonState.strokes.push(balloonState.activeStroke);
    return;
  }

  const stroke = balloonState.activeStroke;
  const last = stroke.points[stroke.points.length - 1];
  const smoothedPoint = new THREE.Vector3(
    last.x + SMOOTHING_FACTOR * (point.x - last.x),
    last.y + SMOOTHING_FACTOR * (point.y - last.y),
    last.z + SMOOTHING_FACTOR * (point.z - last.z)
  );

  if (smoothedPoint.distanceTo(last) < MIN_POINT_DISTANCE) {
    return;
  }

  stroke.points.push(smoothedPoint);
  rebuildBalloonGeometry(
    stroke,
    1 +
      Math.sin(performance.now() / DRAWING_ANIMATION_PERIOD) *
        DRAWING_ANIMATION_AMPLITUDE
  );
}

export function releaseActiveStroke(
  balloonState: BalloonState,
  scene: THREE.Scene,
  pinchReleaseState: PinchReleaseState,
  previousDrawPoint: DrawPoint
): void {
  const stroke = balloonState.activeStroke;
  if (!stroke) return;

  if (stroke.points.length < MIN_POINTS_FOR_BALLOON) {
    scene.remove(stroke.mesh);
    scene.remove(stroke.startCap);
    scene.remove(stroke.endCap);
    stroke.mesh.geometry.dispose();
    stroke.startCap.geometry.dispose();
    stroke.endCap.geometry.dispose();
    stroke.mesh.material.dispose();
    balloonState.strokes = balloonState.strokes.filter(
      (entry) => entry.id !== stroke.id
    );
  } else {
    stroke.velocityY = -40;
    stroke.bounce = 1;
    stroke.landed = false;
    stroke.toppling = false;
    stroke.angularVelocity = 0;
    rebuildBalloonGeometry(stroke, 1);
  }

  balloonState.activeStroke = null;
  pinchReleaseState.lostAt = null;
  previousDrawPoint.x = 0;
  previousDrawPoint.y = 0;
}

export function clearAllStrokes(
  balloonState: BalloonState,
  three: ThreeState,
  pinchReleaseState: PinchReleaseState,
  previousDrawPoint: DrawPoint
): void {
  releaseActiveStroke(balloonState, three.scene, pinchReleaseState, previousDrawPoint);
  emitClearParticles(balloonState.strokes, three.scene);
  balloonState.strokes.forEach((stroke) => {
    three.scene.remove(stroke.mesh);
    three.scene.remove(stroke.startCap);
    three.scene.remove(stroke.endCap);
    stroke.mesh.geometry.dispose();
    stroke.startCap.geometry.dispose();
    stroke.endCap.geometry.dispose();
    stroke.mesh.material.dispose();
  });
  balloonState.strokes = [];
}

function emitClearParticles(strokes: BalloonStroke[], scene: THREE.Scene): void {
  const particlePositions: number[] = [];
  const particleColors: number[] = [];

  strokes.forEach((stroke) => {
    stroke.points.forEach((point, index) => {
      if (index % CLEAR_PARTICLE_SAMPLE_STEP !== 0) return;
      for (let burst = 0; burst < CLEAR_PARTICLES_PER_POINT; burst++) {
        const scatterAngle = Math.random() * Math.PI * 2;
        const scatterRadius = Math.random() * CLEAR_PARTICLE_SIZE * 1.6;
        particlePositions.push(
          point.x + Math.cos(scatterAngle) * scatterRadius,
          point.y + (Math.random() - 0.5) * scatterRadius,
          point.z + Math.sin(scatterAngle) * scatterRadius
        );
        particleColors.push(stroke.color.r, stroke.color.g, stroke.color.b);
      }
    });
  });

  if (particlePositions.length === 0) return;

  const particleCount = particlePositions.length / 3;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particlePositions);
  const colors = new Float32Array(particleColors);
  const velocities = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const vertical = (Math.random() - 0.12) * CLEAR_PARTICLE_SPREAD;
    const lateral = CLEAR_PARTICLE_SPREAD * (0.36 + Math.random() * 0.9);
    velocities[i * 3] = Math.cos(angle) * lateral;
    velocities[i * 3 + 1] = vertical;
    velocities[i * 3 + 2] = Math.sin(angle) * lateral;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: CLEAR_PARTICLE_SIZE,
    transparent: true,
    opacity: 0.95,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const startedAt = performance.now();
  let previous = startedAt;

  const animate = (now: number) => {
    const age = now - startedAt;
    const deltaSeconds = Math.min((now - previous) / 1000, 0.033);
    previous = now;

    const positionAttribute = geometry.getAttribute("position");
    for (let i = 0; i < particleCount; i++) {
      velocities[i * 3 + 1] -= CLEAR_PARTICLE_GRAVITY * deltaSeconds;
      positionAttribute.setX(
        i,
        positionAttribute.getX(i) + velocities[i * 3] * deltaSeconds
      );
      positionAttribute.setY(
        i,
        positionAttribute.getY(i) + velocities[i * 3 + 1] * deltaSeconds
      );
      positionAttribute.setZ(
        i,
        positionAttribute.getZ(i) + velocities[i * 3 + 2] * deltaSeconds
      );
    }
    positionAttribute.needsUpdate = true;
    const holdMs = CLEAR_PARTICLE_LIFETIME_MS * 0.22;
    const fadeProgress = Math.max(
      0,
      (age - holdMs) / (CLEAR_PARTICLE_LIFETIME_MS - holdMs)
    );
    const expansion = Math.min(age / 320, 1);
    material.opacity = Math.max(0, 1 - fadeProgress);
    material.size = CLEAR_PARTICLE_SIZE * (1 + expansion * 0.26);

    if (age < CLEAR_PARTICLE_LIFETIME_MS) {
      requestAnimationFrame(animate);
      return;
    }

    scene.remove(points);
    geometry.dispose();
    material.dispose();
  };

  requestAnimationFrame(animate);
}
