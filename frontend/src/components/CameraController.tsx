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

// Strict safe inner room envelope so camera can NEVER exit walls (+-18m), credenzas (+-17.15m),
// corner chandelier inner rings (16.80m), or ceiling strip lights (16.74m).
const SAFE_MAX_WALL_COORD = 16.6;
const SAFE_MAX_HORIZ_RADIUS = 16.5;
const SAFE_MAX_Y = ROOM_HEIGHT - 0.85; // 15.95m (strictly below 16.74m strip lights!)
const SAFE_MIN_Y = 1.55;

const PRESET_CONFIGS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  front: {
    pos: [0, 4.95, 9.2],
    target: [0, 1.85, 0],
  },
  top: {
    pos: [0, 12.6, 0.25], // Fits entire 9.68m board + borders cleanly between HUD bars & below ceiling
    target: [0, 1.35, 0],
  },
  white: {
    pos: [0, 4.75, 8.8],
    target: [0, 1.85, 0],
  },
  black: {
    pos: [0, 4.75, -8.8],
    target: [0, 1.85, 0],
  },
  cinematic: {
    pos: [7.2, 4.2, 7.2],
    target: [0, 1.85, 0],
  },
  free: {
    pos: [4.6, 4.2, 6.6],
    target: [0, 1.85, 0],
  },
};

// Reusable scratch objects to eliminate per-frame allocations inside useFrame
const _offsetVec = new THREE.Vector3();
const _targetOffsetVec = new THREE.Vector3();
const _curSpherical = new THREE.Spherical();
const _tgtSpherical = new THREE.Spherical();

export const CameraController: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, size, invalidate } = useThree();

  const cameraPreset = useGameStore((s) => s.cameraPreset);
  const setCameraPreset = useGameStore((s) => s.setCameraPreset);
  const isFlipped = useGameStore((s) => s.isFlipped);
  const isMobile = useGameStore((s) => s.isMobile);

  const aspect = size.width / Math.max(size.height, 1);
  const isPortrait = aspect < 1.0;
  // Detect mobile/compact landscape (e.g. 844x390 phone rotated sideways where HUD covers top/bottom bands)
  const isCompactLandscape = !isPortrait && size.height < 540;

  // Hor+ FOV scaling: desktop/standard landscape keeps strictly 56 deg;
  // portrait widens vertical FOV so horizontal span fits all 64 squares & borders;
  // compact phone landscape slightly widens FOV (68 deg) so board fits cleanly between top/bottom HUD bars.
  const targetFov = useMemo(() => {
    if (isPortrait) {
      const desiredTanHalfH = 0.455;
      const computedFov = (2 * Math.atan(desiredTanHalfH / Math.max(aspect, 0.42)) * 180) / Math.PI;
      return Math.min(88, Math.max(56, computedFov));
    }
    if (isCompactLandscape) {
      return 68;
    }
    return 56;
  }, [isPortrait, isCompactLandscape, aspect]);

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

  // Distance multiplier for preset framing on portrait & compact landscape viewports
  const distanceFactor = useMemo(() => {
    if (isPortrait) {
      return Math.min(2.08, Math.max(1.22, 0.96 / Math.max(aspect, 0.44)));
    }
    if (isCompactLandscape) {
      return 1.48;
    }
    return 1.0;
  }, [isPortrait, isCompactLandscape, aspect]);

  // Max orbit distance calibrated so full 4-corner board diagonal (outer radius ~6.85m + margin)
  // remains 100% visible horizontally and vertically while staying strictly inside the room.
  const desiredMaxDistance = useMemo(() => {
    const tanHalfV = Math.tan(((targetFov * Math.PI) / 180) * 0.5);
    const tanHalfH = tanHalfV * aspect;
    if (isPortrait) {
      const diagFitDist = 7.45 / Math.max(Math.min(tanHalfH, tanHalfV), 0.36);
      return Math.min(18.5, Math.max(16.2, diagFitDist));
    }
    if (isCompactLandscape) {
      return 17.5;
    }
    return 15.8;
  }, [isPortrait, isCompactLandscape, aspect, targetFov]);

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
        const tanHalfV = Math.tan(((targetFov * Math.PI) / 180) * 0.5);
        const tanHalfH = tanHalfV * aspect;
        if (isPortrait) {
          // Leave clean margin around all 4 outer board borders (5.4m half-width)
          const neededHeight = 5.4 / Math.max(tanHalfH, 0.36);
          pos.y = Math.min(SAFE_MAX_Y - 0.1, 1.35 + neededHeight);
        } else if (isCompactLandscape) {
          // Fit Ranks 1-8 cleanly between mobile landscape top & bottom HUD bars
          const neededHeight = 9.8 / Math.max(tanHalfV, 0.45);
          pos.y = Math.min(SAFE_MAX_Y - 0.1, 1.35 + neededHeight);
        } else {
          pos.y = Math.min(SAFE_MAX_Y - 0.1, 12.6);
        }
        pos.z = 0.25;
      } else if (preset === 'cinematic') {
        if (isPortrait || isCompactLandscape) {
          pos.x *= 1.3;
          pos.y *= 1.2;
          pos.z *= 1.3;
        }
      } else if (preset !== 'free') {
        if (isPortrait || isCompactLandscape) {
          pos.y *= distanceFactor;
          pos.z *= distanceFactor;
          target.y = isPortrait ? 1.72 : 1.78;
        }
      }

      // Clamp preset endpoint strictly inside room safety bounds
      pos.x = THREE.MathUtils.clamp(pos.x, -SAFE_MAX_WALL_COORD, SAFE_MAX_WALL_COORD);
      pos.z = THREE.MathUtils.clamp(pos.z, -SAFE_MAX_WALL_COORD, SAFE_MAX_WALL_COORD);
      pos.y = THREE.MathUtils.clamp(pos.y, SAFE_MIN_Y, SAFE_MAX_Y);
      const horiz = Math.hypot(pos.x, pos.z);
      if (horiz > SAFE_MAX_HORIZ_RADIUS) {
        const s = SAFE_MAX_HORIZ_RADIUS / horiz;
        pos.x *= s;
        pos.z *= s;
      }

      return { pos, target };
    },
    [distanceFactor, isPortrait, isCompactLandscape, aspect, targetFov]
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
      invalidate();
    }
  }, [cameraPreset, isFlipped, getPresetCoords, invalidate]);

  // Adjust initial camera framing cleanly for portrait / compact-landscape on first mount
  useEffect(() => {
    if ((isPortrait || isCompactLandscape) && cameraPreset === 'front') {
      const { pos, target } = getPresetCoords('front', isFlipped);
      camera.position.copy(pos);
      if (controlsRef.current) {
        controlsRef.current.target.copy(target);
        controlsRef.current.update();
      }
    }
    // Intentionally run once on mount for initial viewport framing
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

    controls.maxDistance = desiredMaxDistance;

    controls.addEventListener('start', handleInteractionStart);
    return () => {
      controls.removeEventListener('start', handleInteractionStart);
    };
  }, [setCameraPreset, desiredMaxDistance]);

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
      const radius = isPortrait ? 11.2 : isCompactLandscape ? 10.0 : 8.5;
      const height = (isPortrait ? 6.0 : 4.2) + Math.sin(t * 0.5) * 0.45;
      camera.position.set(Math.sin(t) * radius, Math.min(SAFE_MAX_Y, height), Math.cos(t) * radius);
      controls.target.set(0, 1.8, 0);
      controls.update();
      invalidate();
      return;
    }

    // 2. Smooth spherical preset transition (sweeps cleanly around the board instead of clipping through center pieces)
    if (isTransitioningRef.current) {
      const alpha = 1 - Math.exp(-delta * 6.0);
      controls.target.lerp(targetLookRef.current, alpha);

      _offsetVec.subVectors(camera.position, controls.target);
      _targetOffsetVec.subVectors(targetPosRef.current, targetLookRef.current);

      _curSpherical.setFromVector3(_offsetVec);
      _tgtSpherical.setFromVector3(_targetOffsetVec);

      let dTheta = _tgtSpherical.theta - _curSpherical.theta;
      while (dTheta > Math.PI) dTheta -= Math.PI * 2;
      while (dTheta < -Math.PI) dTheta += Math.PI * 2;

      _curSpherical.theta += dTheta * alpha;
      _curSpherical.phi += (_tgtSpherical.phi - _curSpherical.phi) * alpha;
      _curSpherical.radius += (_tgtSpherical.radius - _curSpherical.radius) * alpha;

      _offsetVec.setFromSpherical(_curSpherical);
      camera.position.copy(controls.target).add(_offsetVec);

      if (
        camera.position.distanceTo(targetPosRef.current) < 0.05 &&
        controls.target.distanceTo(targetLookRef.current) < 0.02
      ) {
        camera.position.copy(targetPosRef.current);
        controls.target.copy(targetLookRef.current);
        isTransitioningRef.current = false;
      } else {
        invalidate();
      }
    } else {
      // Smoothly maintain target height consistently at 1.85m (eliminates jump on chandelier/scene clicks)
      const desiredTargetY = cameraPreset === 'top' ? 1.35 : 1.85;
      const dy = Math.abs(controls.target.y - desiredTargetY);
      const nextY =
        dy > 0.001
          ? THREE.MathUtils.damp(controls.target.y, desiredTargetY, 10, delta)
          : desiredTargetY;
      controls.target.set(0, nextY, 0);
      if (dy > 0.001) {
        invalidate();
      }
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
    let clamped = false;
    if (camera.position.y > SAFE_MAX_Y) {
      camera.position.y = SAFE_MAX_Y;
      clamped = true;
    } else if (camera.position.y < SAFE_MIN_Y) {
      camera.position.y = SAFE_MIN_Y;
      clamped = true;
    }
    const clampedX = THREE.MathUtils.clamp(camera.position.x, -SAFE_MAX_WALL_COORD, SAFE_MAX_WALL_COORD);
    const clampedZ = THREE.MathUtils.clamp(camera.position.z, -SAFE_MAX_WALL_COORD, SAFE_MAX_WALL_COORD);
    if (clampedX !== camera.position.x || clampedZ !== camera.position.z) {
      camera.position.x = clampedX;
      camera.position.z = clampedZ;
      clamped = true;
    }
    const horizDist = Math.hypot(camera.position.x, camera.position.z);
    if (horizDist > SAFE_MAX_HORIZ_RADIUS) {
      const s = SAFE_MAX_HORIZ_RADIUS / horizDist;
      camera.position.x *= s;
      camera.position.z *= s;
      clamped = true;
    }
    if (clamped) {
      camera.lookAt(controls.target);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      minDistance={2.8} // Close inspection of carved pieces without clipping geometry
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
