import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { CameraPreset } from '../chess/types';

// Preset Camera Coordinates calibrated for Grand Chess Room (Desktop baseline)
declare global {
  interface Window {
    __lastPinchEndTime?: number;
  }
}

const PRESET_CONFIGS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  front: {
    pos: [0, 4.25, 7.6],
    target: [0, 2.05, 0],
  },
  top: {
    pos: [0, 7.3, 0.2],
    target: [0, 1.35, 0],
  },
  white: {
    pos: [0, 3.95, 6.9],
    target: [0, 2.05, 0],
  },
  black: {
    pos: [0, 3.95, -6.9],
    target: [0, 2.05, 0],
  },
  cinematic: {
    pos: [7.0, 4.0, 7.0],
    target: [0, 1.9, 0],
  },
  free: {
    pos: [4.6, 4.2, 6.6],
    target: [0, 2.0, 0],
  },
};

export const CameraController: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();

  const cameraPreset = useGameStore((s) => s.cameraPreset);
  const setCameraPreset = useGameStore((s) => s.setCameraPreset);
  const isFlipped = useGameStore((s) => s.isFlipped);
  const isMobile = useGameStore((s) => s.isMobile);

  // Dynamic aspect ratio calculation
  const aspect = size.width / Math.max(size.height, 1);
  const isPortrait = aspect < 1.0;

  // Adapt camera FOV on portrait / narrow screens so horizontal field of view doesn't collapse
  // Desktop/laptop (aspect >= 1.0) stays strictly at 56° (desktop baseline unchanged)
  useEffect(() => {
    const pCam = camera as THREE.PerspectiveCamera;
    if (!pCam.isPerspectiveCamera) return;

    const targetFov = aspect < 1.0
      ? Math.min(68, Math.max(56, 56 + (1.0 - aspect) * 20))
      : 56;

    if (Math.abs(pCam.fov - targetFov) > 0.1) {
      pCam.fov = targetFov;
      pCam.updateProjectionMatrix();
    }
  }, [camera, aspect]);

  // Responsive distance multiplier so all 64 squares fit inside narrower mobile/tablet viewports
  // On desktop/laptop (aspect >= 1.0), distanceFactor is strictly 1.0, preserving desktop visuals
  const distanceFactor = useMemo(() => {
    if (!isPortrait) return 1.0;
    return Math.min(1.65, Math.max(1.1, 0.88 / Math.max(aspect, 0.45)));
  }, [isPortrait, aspect]);

  // Dynamic maximum distance: ensures the ENTIRE chessboard, outer gold perimeter lip,
  // bevels, and surrounding table remain 100% visible without ANY edge cropping at max zoom-out
  const dynamicMaxDistance = useMemo(() => {
    if (!isPortrait) return 15.0; // Desktop baseline
    const pCam = camera as THREE.PerspectiveCamera;
    const fovRad = ((pCam.fov || 56) * Math.PI) / 180;
    const tanH = Math.tan(fovRad / 2) * aspect;
    // Board outer diagonal is ~13m; require visible horizontal half-span >= 6.4m
    const requiredDistance = 6.4 / Math.max(tanH, 0.22);
    return Math.min(19.5, Math.max(15.5, requiredDistance));
  }, [isPortrait, aspect, camera]);

  // Target positions for smooth lerping
  const targetPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 4.3, 7.8));
  const targetLookRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.8, 0));
  const isTransitioningRef = useRef(false);

  // Track previous preset and flipped state to ONLY trigger transitions on intentional changes
  const prevPresetRef = useRef<CameraPreset>(cameraPreset);
  const prevFlippedRef = useRef<boolean>(isFlipped);

  // Function to compute camera coordinates for a preset
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
        pos.y *= distanceFactor;
      } else if (preset === 'cinematic') {
        if (isPortrait) {
          pos.x *= 1.3;
          pos.y *= 1.2;
          pos.z *= 1.3;
        }
      } else if (preset !== 'free') {
        if (isPortrait) {
          pos.y *= 1.08 * distanceFactor;
          pos.z *= distanceFactor;
          target.y *= 0.95;
        }
      }

      return { pos, target };
    },
    [distanceFactor, isPortrait]
  );

  // Initiate transition ONLY when preset or flipped changes explicitly
  useEffect(() => {
    const presetChanged = prevPresetRef.current !== cameraPreset;
    const flippedChanged = prevFlippedRef.current !== isFlipped;

    prevPresetRef.current = cameraPreset;
    prevFlippedRef.current = isFlipped;

    // Do NOT auto-transition if preset is 'free' (user is in manual orbit mode)
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

  // Connect to OrbitControls start event:
  // As soon as the user touches/drags with fingers or mouse, immediately cancel any
  // programmatic transition and switch to 'free' mode so controls never fight the user!
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

  // Global pinch-gesture tracking to completely eliminate accidental piece selection during or right after pinch zoom
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

  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Cinematic continuous slow panoramic sweep around the gallery
    if (cameraPreset === 'cinematic') {
      const t = state.clock.getElapsedTime() * 0.12;
      const radius = 8.5 * (isPortrait ? 1.25 : 1.0);
      const height = (4.2 + Math.sin(t * 0.5) * 0.5) * (isPortrait ? 1.2 : 1.0);
      camera.position.x = Math.sin(t) * radius;
      camera.position.z = Math.cos(t) * radius;
      camera.position.y = height;
      controls.target.set(0, 1.8, 0);
      controls.update();
      return;
    }

    // Smooth lerp transition to programmatic preset
    if (isTransitioningRef.current) {
      camera.position.lerp(targetPosRef.current, delta * 4.5);
      controls.target.lerp(targetLookRef.current, delta * 4.5);

      if (camera.position.distanceTo(targetPosRef.current) < 0.05) {
        camera.position.copy(targetPosRef.current);
        controls.target.copy(targetLookRef.current);
        isTransitioningRef.current = false;
      }
    }

    // Lock camera target directly on board center so orbit always rotates around the chessboard
    controls.target.set(0, 1.8, 0);

    // Update controls for silky smooth damping
    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      minDistance={2.6} // Close inspection of pieces without clipping
      maxDistance={dynamicMaxDistance} // Calibrated so all 64 squares & board frame are 100% visible at max zoom-out
      minPolarAngle={0.06} // Almost straight down top view (no flip)
      maxPolarAngle={1.52} // Low table angle, stops safely at tabletop/floor level
      enableRotate={true}
      rotateSpeed={isMobile ? 0.72 : 0.8}
      enableZoom={true}
      zoomSpeed={isMobile ? 0.75 : 0.8} // Silky smooth calibrated pinch zoom without jumps
      enablePan={false} // Disable panning so two-finger pinch zoom is pure, centered, with zero drift or jitter
      touches={{
        ONE: THREE.TOUCH.ROTATE, // 1 finger = 360° orbit
        TWO: THREE.TOUCH.DOLLY_PAN, // 2 fingers = pure pinch zoom
      }}
    />
  );
};
