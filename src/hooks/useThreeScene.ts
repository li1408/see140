import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { stepPhysics } from "@/lib/balloon/physics";
import { THEME_PALETTES } from "@/lib/themes";
import type { ThreeState, BalloonState, ThemeMode, WindVector } from "@/lib/types";
import { DRAW_PLANE_Z, MAX_FRAME_TIME_SECONDS } from "@/lib/constants";
import { getVisiblePlaneBounds } from "@/lib/three/projection";

type UseThreeSceneOptions = {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  themeMode: ThemeMode;
  balloonStateRef: MutableRefObject<BalloonState>;
  windStateRef: MutableRefObject<WindVector>;
  windTargetRef: MutableRefObject<WindVector>;
  enableBalloonFallRef: MutableRefObject<boolean>;
  onResize: (width: number, height: number) => void;
};

const WIND_PARTICLE_COUNT = 560;
const WIND_PARTICLE_BASE_OPACITY = 0.24;
const WIND_PARTICLE_ACTIVE_OPACITY = 0.54;
const WIND_PARTICLE_BASE_SIZE = 2.3;
const WIND_PARTICLE_ACTIVE_SIZE = 1.9;
const WIND_PARTICLE_RESPONSE_SCALE = 0.082;

export function useThreeScene({
  containerRef,
  themeMode,
  balloonStateRef,
  windStateRef,
  windTargetRef,
  enableBalloonFallRef,
  onResize,
}: UseThreeSceneOptions): {
  threeRef: MutableRefObject<ThreeState | null>;
  canvasSizeRef: MutableRefObject<{ width: number; height: number }>;
} {
  const threeRef = useRef<ThreeState | null>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  // Use a ref to always read latest themeMode inside the resize closure
  const themeModeRef = useRef(themeMode);

  useEffect(() => {
    themeModeRef.current = themeMode;
  }, [themeMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const palette = THEME_PALETTES[themeModeRef.current];
    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(palette.fog, 300, 2300);

    const camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      1,
      5000
    );
    camera.position.set(0, 0, 1120);
    camera.lookAt(0, 0, 0);

    const getWorldBounds = (width: number, height: number) => {
      const previousZoom = camera.zoom;
      if (previousZoom !== 1) {
        camera.zoom = 1;
        camera.updateProjectionMatrix();
      }

      const bounds = getVisiblePlaneBounds(
        { width, height },
        camera,
        DRAW_PLANE_Z
      );

      if (camera.zoom !== previousZoom) {
        camera.zoom = previousZoom;
        camera.updateProjectionMatrix();
      }

      return bounds;
    };

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearAlpha(0);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight("#ffffff", 0.86);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight("#b8dcff", 1.08);
    keyLight.position.set(220, 300, 500);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.PointLight("#c58cff", 0.85, 2600);
    rimLight.position.set(-260, 120, 420);
    scene.add(rimLight);

    const initialWidth = window.innerWidth;
    const initialHeight = window.innerHeight;
    const initialBounds = getWorldBounds(initialWidth, initialHeight);
    const tankDepth = Math.max(320, Math.min(initialWidth, initialHeight) * 0.62);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(initialBounds.width, tankDepth),
      new THREE.MeshStandardMaterial({
        color: palette.floor,
        roughness: 0.92,
        metalness: 0.08,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = initialBounds.bottom;
    floor.receiveShadow = true;
    scene.add(floor);

    balloonStateRef.current.tankDepth = tankDepth;

    const boxGeometry = new THREE.BoxGeometry(
      initialBounds.width,
      initialBounds.height,
      tankDepth
    );
    const edges = new THREE.EdgesGeometry(boxGeometry);
    const tank = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: palette.tank,
        transparent: true,
        opacity: 0.42,
      })
    );
    scene.add(tank);

    const driftParticles = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: palette.particle,
        size: WIND_PARTICLE_BASE_SIZE,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      })
    );
    const particleCount = WIND_PARTICLE_COUNT;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] =
        initialBounds.left + Math.random() * initialBounds.width;
      positions[i * 3 + 1] =
        initialBounds.bottom + Math.random() * initialBounds.height;
      positions[i * 3 + 2] = (Math.random() - 0.5) * tankDepth;
    }
    driftParticles.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    scene.add(driftParticles);

    const three: ThreeState = {
      scene,
      camera,
      renderer,
      tank,
      floor,
      driftParticles,
      animationFrame: 0,
      viewScale: 1,
      leftWall: initialBounds.left,
      rightWall: initialBounds.right,
      topWall: initialBounds.top,
      bottomWall: initialBounds.bottom,
      backWall: -tankDepth / 2,
      frontWall: tankDepth / 2,
    };
    threeRef.current = three;

    let previous = performance.now();
    const animate = () => {
      if (!threeRef.current) return;
      const now = performance.now();
      const deltaSeconds = Math.min(
        (now - previous) / 1000,
        MAX_FRAME_TIME_SECONDS
      );
      previous = now;

      stepPhysics(
        deltaSeconds,
        balloonStateRef.current,
        threeRef.current,
        windStateRef.current,
        windTargetRef.current,
        enableBalloonFallRef.current
      );

      const attrs = driftParticles.geometry.getAttribute("position");
      const windMagnitude = Math.hypot(
        windStateRef.current.x,
        windStateRef.current.y,
        windStateRef.current.z
      );
      const windVisualStrength = Math.min(windMagnitude / 6200, 1);
      const particleIdleDrift = 4;
      for (let i = 0; i < attrs.count; i++) {
        const turbulence =
          Math.sin(now * 0.0017 + i * 12.9898) * windVisualStrength * 16;
        const crossTurbulence =
          Math.cos(now * 0.0013 + i * 7.233) * windVisualStrength * 10;
        let x =
          attrs.getX(i) +
          (windStateRef.current.x * WIND_PARTICLE_RESPONSE_SCALE +
            turbulence) *
            deltaSeconds;
        let y =
          attrs.getY(i) +
          (windStateRef.current.y * WIND_PARTICLE_RESPONSE_SCALE * 0.5 +
            crossTurbulence) *
            deltaSeconds -
          deltaSeconds * particleIdleDrift;
        let z =
          attrs.getZ(i) +
          (windStateRef.current.z * WIND_PARTICLE_RESPONSE_SCALE +
            crossTurbulence * 0.6) *
            deltaSeconds;

        if (x < three.leftWall) x = three.rightWall;
        if (x > three.rightWall) x = three.leftWall;
        if (y < three.bottomWall) y = three.topWall;
        if (y > three.topWall) y = three.bottomWall;
        if (z < three.backWall) z = three.frontWall;
        if (z > three.frontWall) z = three.backWall;

        attrs.setXYZ(i, x, y, z);
      }
      attrs.needsUpdate = true;
      driftParticles.material.opacity =
        WIND_PARTICLE_BASE_OPACITY +
        windVisualStrength * WIND_PARTICLE_ACTIVE_OPACITY;
      driftParticles.material.size =
        WIND_PARTICLE_BASE_SIZE +
        windVisualStrength * WIND_PARTICLE_ACTIVE_SIZE;

      three.renderer.render(three.scene, three.camera);
      three.animationFrame = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const activeThree = threeRef.current;
      if (!activeThree) return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const depth = Math.max(320, Math.min(width, height) * 0.62);
      balloonStateRef.current.tankDepth = depth;

      canvasSizeRef.current = { width, height };
      onResize(width, height);

      activeThree.camera.aspect = width / height;
      activeThree.camera.updateProjectionMatrix();
      const bounds = getWorldBounds(width, height);
      activeThree.renderer.setSize(width, height);

      activeThree.leftWall = bounds.left;
      activeThree.rightWall = bounds.right;
      activeThree.topWall = bounds.top;
      activeThree.bottomWall = bounds.bottom;
      activeThree.backWall = -depth / 2;
      activeThree.frontWall = depth / 2;
      activeThree.floor.position.y = activeThree.bottomWall;
      activeThree.floor.geometry.dispose();
      activeThree.floor.geometry = new THREE.PlaneGeometry(bounds.width, depth);

      activeThree.scene.remove(activeThree.tank);
      activeThree.tank.geometry.dispose();
      if (Array.isArray(activeThree.tank.material)) {
        activeThree.tank.material.forEach((m) => m.dispose());
      } else {
        activeThree.tank.material.dispose();
      }

      const newEdges = new THREE.EdgesGeometry(
        new THREE.BoxGeometry(bounds.width, bounds.height, depth)
      );
      const newTank = new THREE.LineSegments(
        newEdges,
        new THREE.LineBasicMaterial({
          color: THEME_PALETTES[themeModeRef.current].tank,
          transparent: true,
          opacity: 0.42,
        })
      );
      activeThree.scene.add(newTank);
      activeThree.tank = newTank;
    };

    // Run once immediately to initialise canvasSizeRef
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(three.animationFrame);
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      threeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update scene colors when theme changes
  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;

    const palette = THEME_PALETTES[themeMode];
    three.scene.background = null;
    three.scene.fog = new THREE.Fog(palette.fog, 300, 2300);
    three.floor.material.color.set(palette.floor);

    const tankMaterial = three.tank.material;
    if (Array.isArray(tankMaterial)) {
      tankMaterial.forEach((m) => {
        if ("color" in m) (m as THREE.MeshStandardMaterial).color.set(palette.tank);
      });
    } else if ("color" in tankMaterial) {
      (tankMaterial as THREE.MeshStandardMaterial).color.set(palette.tank);
    }
    three.driftParticles.material.color.set(palette.particle);
  }, [themeMode]);

  return { threeRef, canvasSizeRef };
}
