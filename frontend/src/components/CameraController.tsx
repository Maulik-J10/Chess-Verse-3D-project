import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { CameraPreset } from '../chess/types';

// Preset Camera Coordinates calibrated for Grand Chess Room (Desktop baseline)
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

  // Responsive distance multiplier so all 64 squares fit inside narrower mobile/tablet viewports
  // On desktop/laptop (aspect >= 1.0), distanceFactor is strictly 1.0, preserving desktop visuals
  const distanceFactor = useMemo(() => {
    if (!isPortrait) return 1.0;
    return Math.min(2.1, Math.max(1.15, 0.92 / Math.max(aspect, 0.42)));
  }, [isPortrait, aspect]);

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

    // Clamp camera target so two-finger pan never loses the chessboard
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -4.5, 4.5);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0.5, 3.5);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -4.5, 4.5);

    // Update controls for silky smooth damping
    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      minDistance={2.4} // Close inspection of pieces
      maxDistance={15.0} // Zoom out to view gallery room
      minPolarAngle={0.05} // Almost straight down top view (no flip)
      maxPolarAngle={1.52} // Low table angle, stops at floor level
      enableRotate={true}
      rotateSpeed={isMobile ? 0.75 : 0.8}
      enableZoom={true}
      zoomSpeed={isMobile ? 0.95 : 0.8}
      enablePan={true} // Full two-finger pan support!
      panSpeed={isMobile ? 0.8 : 0.8}
      screenSpacePanning={true}
      touches={{
        ONE: THREE.TOUCH.ROTATE, // 1 finger = 360° orbit
        TWO: THREE.TOUCH.DOLLY_PAN, // 2 fingers = pinch zoom + pan
      }}
    />
  );
};
