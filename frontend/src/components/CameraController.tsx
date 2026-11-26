import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { CameraPreset } from '../chess/types';
import { ROOM_HEIGHT } from './RoomEnvironment';

declare global {
  interface Window {
    __lastPinchEndTime?: number;
  }
}

// Strict safe inner room envelope so camera can NEVER exit walls, pass above ceiling/strip lights,
// or hit corner chandeliers/credenzas (walls at +-18m, chandeliers at +-12.8m, strip lights at 14.54m).
const SAFE_MAX_WALL_COORD = 15.8;
const SAFE_MAX_HORIZ_RADIUS = 15.6;
const SAFE_MAX_Y = ROOM_HEIGHT - 0.85; // 13.75m (strictly below 14.54m strip lights!)
const SAFE_MIN_Y = 1.55;

const PRESET_CONFIGS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  front: {
    pos: [0, 4.25, 7.6],
    target: [0, 2.0, 0],
  },
  top: {
    pos: [0, 11.45, 0.25], // Fits entire 9.68m board + borders cleanly on desktop & below 14.54m ceiling
    target: [0, 1.35, 0],
  },
  white: {
    pos: [0, 3.95, 6.9],
    target: [0, 2.0, 0],
  },
  black: {
    pos: [0, 3.95, -6.9],
    target: [0, 2.0, 0],
  },
  cinematic: {
    pos: [7.2, 4.2, 7.2],
    target: [0, 1.85, 0],
  },
  free: {
    pos: [4.6, 4.2, 6.6],
    target: [0, 1.9, 0],
  },
};

// Reusable scratch vector to eliminate per-frame allocations inside useFrame
const _offsetVec = new THREE.Vector3();

export const CameraController: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();

  const cameraPreset = useGameStore((s) => s.cameraPreset);
  const setCameraPreset = useGameStore((s) => s.setCameraPreset);
  const isFlipped = useGameStore((s) => s.isFlipped);
  const isMobile = useGameStore((s) => s.isMobile);

  const aspect = size.width / Math.max(size.height, 1);
  const isPortrait = aspect < 1.0;

  // Hor+ FOV scaling: desktop/landscape (>= 1.0) stays strictly at 56 deg;
  // portrait viewports smoothly widen vertical FOV so horizontal span fits all 64 squares & borders cleanly.
  const targetFov = useMemo(() => {
    if (!isPortrait) return 56;
    const desiredTanHalfH = 0.415; // Preserves ~45 deg horizontal FOV across skinny phones
    const computedFov = (2 * Math.atan(desiredTanHalfH / Math.max(aspect, 0.42)) * 180) / Math.PI;
    return Math.min(85, Math.max(56, computedFov));
  }, [isPortrait, aspect]);

  useEffect(() => {
    const pCam = camera as THREE.PerspectiveCamera;
    if (!pCam.isPerspectiveCamera) return;

    let changed = false;
    if (Math.abs(pCam.fov - targetFov) > 0.1) {
      pCam.fov = targetFov;
      changed = true;
    }
    if (pCam.near !== 0.25 || pCam.far !== 85) {
      pCam.near = 0.25;
      pCam.far = 85;
      changed = true;
    }
    if (changed) {
      pCam.updateProjectionMatrix();
    }
  }, [camera, targetFov]);

  // Distance multiplier for preset framing on portrait viewports
  const distanceFactor = useMemo(() => {
    if (!isPortrait) return 1.0;
    return Math.min(1.52, Math.max(1.08, 0.72 / Math.max(aspect, 0.45)));
  }, [isPortrait, aspect]);

  // Max orbit distance calibrated to show full 4-corner board diagonal (~13.68m) while fitting inside room
  const desiredMaxDistance = useMemo(() => {
    if (!isPortrait) return 15.0; // Desktop baseline
    const tanHalfH = Math.tan(((targetFov * Math.PI) / 180) * 0.5) * aspect;
    const diagFitDist = 6.95 / Math.max(tanHalfH, 0.34);
    return Math.min(17.4, Math.max(15.2, diagFitDist));
  }, [isPortrait, aspect, targetFov]);

  const targetPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 4.25, 7.6));
  const targetLookRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.85, 0));
  const isTransitioningRef = useRef(false);
  const cinematicClockRef = useRef(0);

  const prevPresetRef = useRef<CameraPreset>(cameraPreset);
  const prevFlippedRef = useRef<boolean>(isFlipped);

  const getPresetCoords = useCallback(
    (preset: CameraPreset, flipped: boolean) => {
      let cfg = PRESET_CONFIGS[preset] || PRESET_CONFIGS.front;

      if (flipped) {
        if (preset === 'white') cfg = PRESET_CONFIGS.black;
        else if (preset === 'black') cfg = PRESET_CONFIGS.white;
      }

      const pos = new THREE.Vector3(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      const target = new THREE.Vector3(cfg.target[0], cfg.target[1], cfg.target[2]);

      if (preset === 'top') {
        // Compute safe top-down elevation below strip lights that fits entire 9.68m board + borders
        if (isPortrait) {
          const tanHalfH = Math.tan(((targetFov * Math.PI) / 180) * 0.5) * aspect;
          const neededHeight = 5.05 / Math.max(tanHalfH, 0.34);
          pos.y = Math.min(SAFE_MAX_Y - 0.1, 1.35 + neededHeight);
        } else {
          pos.y = Math.min(SAFE_MAX_Y - 0.1, 11.45);
        }
        pos.z = 0.25;
      } else if (preset === 'cinematic') {
        if (isPortrait) {
          pos.x *= 1.25;
          pos.y *= 1.15;
          pos.z *= 1.25;
        }
      } else if (preset !== 'free') {
        if (isPortrait) {
          pos.y *= 1.05 * distanceFactor;
          pos.z *= distanceFactor;
          target.y = 1.75;
        }
      }

      // Clamp preset endpoint strictly inside room safety bounds
      pos.x = THREE.MathUtils.clamp(pos.x, -SAFE_MAX_WALL_COORD, SAFE_MAX_WALL_COORD);
      pos.z = THREE.MathUtils.clamp(pos.z, -SAFE_MAX_WALL_COORD, SAFE_MAX_WALL_COORD);
      pos.y = THREE.MathUtils.clamp(pos.y, SAFE_MIN_Y, SAFE_MAX_Y);

      return { pos, target };
    },
    [distanceFactor, isPortrait, aspect, targetFov]
  );

  // Trigger smooth camera transition on intentional preset/flip changes
  useEffect(() => {
    const presetChanged = prevPresetRef.current !== cameraPreset;
    const flippedChanged = prevFlippedRef.current !== isFlipped;

    prevPresetRef.current = cameraPreset;
    prevFlippedRef.current = isFlipped;

    if (cameraPreset === 'free') {
      isTransitioningRef.current = false;
      return;
    }

    if (presetChanged || flippedChanged) {
      const { pos, target } = getPresetCoords(cameraPreset, isFlipped);
      targetPosRef.current.copy(pos);
      targetLookRef.current.copy(target);
      isTransitioningRef.current = true;
    }
  }, [cameraPreset, isFlipped, getPresetCoords]);

  // Adjust initial camera framing on first portrait mount cleanly without fighting user later
  useEffect(() => {
    if (isPortrait && cameraPreset === 'front') {
      const { pos, target } = getPresetCoords('front', isFlipped);
      camera.position.copy(pos);
      if (controlsRef.current) {
        controlsRef.current.target.copy(target);
        controlsRef.current.update();
      }
    }
    // Intentionally run once on mount for portrait initial framing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cancel preset transition immediately when user interacts with touch or mouse
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleInteractionStart = () => {
      isTransitioningRef.current = false;
      if (useGameStore.getState().cameraPreset !== 'free') {
        setCameraPreset('free');
      }
    };

    controls.addEventListener('start', handleInteractionStart);
    return () => {
      controls.removeEventListener('start', handleInteractionStart);
    };
  }, [setCameraPreset]);

  // Multi-touch pinch detection: prevents accidental piece selection during/right after two-finger pinch zoom
  useEffect(() => {
    let activeTouches = 0;
    const handleTouchStart = (e: TouchEvent) => {
      activeTouches = e.touches.length;
      if (activeTouches >= 2) {
        window.__lastPinchEndTime = performance.now();
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        window.__lastPinchEndTime = performance.now();
      }
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (activeTouches >= 2) {
        window.__lastPinchEndTime = performance.now();
      }
      activeTouches = e.touches.length;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // 1. Cinematic gallery sweep mode (uses local delta accumulator, zero Clock side-effects)
    if (cameraPreset === 'cinematic') {
      cinematicClockRef.current += delta;
      const t = cinematicClockRef.current * 0.12;
      const radius = isPortrait ? 10.2 : 8.5;
      const height = (isPortrait ? 5.2 : 4.2) + Math.sin(t * 0.5) * 0.45;
      camera.position.set(Math.sin(t) * radius, Math.min(SAFE_MAX_Y, height), Math.cos(t) * radius);
      controls.target.set(0, 1.8, 0);
      controls.update();
      return;
    }

    // 2. Smooth lerp transition toward active preset
    if (isTransitioningRef.current) {
      const alpha = Math.min(1, delta * 5.0);
      camera.position.lerp(targetPosRef.current, alpha);
      controls.target.lerp(targetLookRef.current, alpha);

      if (camera.position.distanceTo(targetPosRef.current) < 0.05) {
        camera.position.copy(targetPosRef.current);
        controls.target.copy(targetLookRef.current);
        isTransitioningRef.current = false;
      }
    } else {
      // Anchor target firmly to chessboard center (slightly lower in steep overhead angles)
      const targetY = cameraPreset === 'top' ? 1.35 : 1.78;
      controls.target.set(0, targetY, 0);
    }

    // 3. Directional Room-Box + Ceiling + Chandelier Envelope Clamping:
    // Computes exact safe radial maxDistance along the camera's current sight ray
    // so OrbitControls NEVER lets the user escape walls or pass above strip lights!
    _offsetVec.subVectors(camera.position, controls.target);
    const len = _offsetVec.length();
    if (len > 0.001) {
      const dirX = _offsetVec.x / len;
      const dirY = _offsetVec.y / len;
      const dirZ = _offsetVec.z / len;
      const horizDir = Math.hypot(dirX, dirZ);

      const maxD_ceil = dirY > 0.01 ? (SAFE_MAX_Y - controls.target.y) / dirY : 999;
      const maxD_horiz = horizDir > 0.01 ? SAFE_MAX_HORIZ_RADIUS / horizDir : 999;
      const maxD_x = Math.abs(dirX) > 0.01 ? SAFE_MAX_WALL_COORD / Math.abs(dirX) : 999;
      const maxD_z = Math.abs(dirZ) > 0.01 ? SAFE_MAX_WALL_COORD / Math.abs(dirZ) : 999;

      const roomSafeMax = Math.max(3.5, Math.min(desiredMaxDistance, maxD_ceil, maxD_horiz, maxD_x, maxD_z));
      controls.maxDistance = roomSafeMax;
    }

    // 4. Update OrbitControls damping
    controls.update();

    // 5. Final hard defensive clamp inside closed gallery interior (prevents burst pinch/scroll escapes)
    if (camera.position.y > SAFE_MAX_Y) camera.position.y = SAFE_MAX_Y;
    if (camera.position.y < SAFE_MIN_Y) camera.position.y = SAFE_MIN_Y;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -SAFE_MAX_WALL_COORD, SAFE_MAX_WALL_COORD);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -SAFE_MAX_WALL_COORD, SAFE_MAX_WALL_COORD);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      minDistance={2.8} // Close inspection of carved pieces without clipping geometry
      maxDistance={desiredMaxDistance}
      minPolarAngle={0.05} // Top-down view cleanly unobstructed
      maxPolarAngle={1.50} // Low tabletop angle, stops safely above floor
      enableRotate={true}
      rotateSpeed={isMobile ? 0.72 : 0.8}
      enableZoom={true}
      zoomSpeed={isMobile ? 0.75 : 0.8} // Smooth calibrated pinch zoom without jumps
      enablePan={false} // Pure centered dolly pinch zoom with zero drift or target wandering
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  );
};
