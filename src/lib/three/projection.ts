import * as THREE from "three";

type ViewportSize = {
  width: number;
  height: number;
};

type PlaneBounds = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const planeNormal = new THREE.Vector3(0, 0, 1);
const raycaster = new THREE.Raycaster();
const normalizedPoint = new THREE.Vector2();
const plane = new THREE.Plane();

export function screenPointToWorldOnPlane(
  x: number,
  y: number,
  viewport: ViewportSize,
  camera: THREE.PerspectiveCamera,
  planeZ: number,
  target = new THREE.Vector3()
): THREE.Vector3 {
  if (viewport.width <= 0 || viewport.height <= 0) {
    return target.set(0, 0, planeZ);
  }

  normalizedPoint.set(
    (x / viewport.width) * 2 - 1,
    -(y / viewport.height) * 2 + 1
  );
  plane.set(planeNormal, -planeZ);
  raycaster.setFromCamera(normalizedPoint, camera);

  if (raycaster.ray.intersectPlane(plane, target)) {
    return target;
  }

  return target.set(0, 0, planeZ);
}

export function getVisiblePlaneBounds(
  viewport: ViewportSize,
  camera: THREE.PerspectiveCamera,
  planeZ: number
): PlaneBounds {
  const topLeft = screenPointToWorldOnPlane(
    0,
    0,
    viewport,
    camera,
    planeZ,
    new THREE.Vector3()
  );
  const topRight = screenPointToWorldOnPlane(
    viewport.width,
    0,
    viewport,
    camera,
    planeZ,
    new THREE.Vector3()
  );
  const bottomLeft = screenPointToWorldOnPlane(
    0,
    viewport.height,
    viewport,
    camera,
    planeZ,
    new THREE.Vector3()
  );

  const left = Math.min(topLeft.x, bottomLeft.x);
  const right = topRight.x;
  const top = Math.max(topLeft.y, topRight.y);
  const bottom = bottomLeft.y;

  return {
    width: right - left,
    height: top - bottom,
    left,
    right,
    top,
    bottom,
  };
}
