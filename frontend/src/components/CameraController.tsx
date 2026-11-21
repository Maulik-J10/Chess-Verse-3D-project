import React, { useRef, useEffect, useMemo } from 'react';
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
    target: [0, 2.15, 0],
  },
  top: {
    // High-angle overhead view directly above board, safely below elevated chandelier (y = 8.0m)
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
  const isFlipped = useGameStore((s) => s.isFlipped);
  const isMobile = useGameStore((s) => s.isMobile);

  // Calculate dynamic aspect ratio and portrait distance factor
  const aspect = size.width / Math.max(size.height, 1);
  const isPortrait = aspect < 1.0;

  // Responsive distance multiplier so all 64 squares fit inside the narrower viewport
  // On desktop (aspect >= 1.0), distanceFactor is strictly 1.0 preserving desktop visuals
  const distanceFactor = useMemo(() => {
    if (!isPortrait) return 1.0;
    // For portrait phones (aspect 0.45 - 0.75), calculate exact distance needed to frame board
    return Math.min(2.1, Math.max(1.15, 0.92 / Math.max(aspect, 0.42)));
  }, [isPortrait, aspect]);

  // Target positions for smooth lerping
  const targetPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 4.3, 7.8));
  const targetLookRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.8, 0));
  const isTransitioningRef = useRef(false);

  // When cameraPreset, isFlipped, or orientation aspect changes, recalculate target
  useEffect(() => {
    let cfg = PRESET_CONFIGS[cameraPreset] || PRESET_CONFIGS.front;

    if (isFlipped) {
      if (cameraPreset === 'white') cfg = PRESET_CONFIGS.black;
      else if (cameraPreset === 'black') cfg = PRESET_CONFIGS.white;
    }

    // Apply responsive mobile distance scaling
    if (cameraPreset === 'top') {
      targetPosRef.current.set(cfg.pos[0], cfg.pos[1] * distanceFactor, cfg.pos[2]);
      targetLookRef.current.set(cfg.target[0], cfg.target[1], cfg.target[2]);
    } else if (cameraPreset === 'cinematic') {
      targetPosRef.current.set(
        cfg.pos[0] * (isPortrait ? 1.3 : 1.0),
        cfg.pos[1] * (isPortrait ? 1.2 : 1.0),
        cfg.pos[2] * (isPortrait ? 1.3 : 1.0)
      );
      targetLookRef.current.set(cfg.target[0], cfg.target[1], cfg.target[2]);
    } else {
      targetPosRef.current.set(
        cfg.pos[0],
        cfg.pos[1] * (isPortrait ? 1.08 * distanceFactor : 1.0),
        cfg.pos[2] * distanceFactor
      );
      targetLookRef.current.set(
        cfg.target[0],
        cfg.target[1] * (isPortrait ? 0.95 : 1.0),
        cfg.target[2]
      );
    }

    isTransitioningRef.current = true;
  }, [cameraPreset, isFlipped, distanceFactor, isPortrait]);

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    // Cinematic continuous slow panoramic sweep around the gallery
    if (cameraPreset === 'cinematic') {
      const t = state.clock.getElapsedTime() * 0.12;
      const radius = 8.5 * (isPortrait ? 1.25 : 1.0);
      const height = (4.2 + Math.sin(t * 0.5) * 0.5) * (isPortrait ? 1.2 : 1.0);
      camera.position.x = Math.sin(t) * radius;
      camera.position.z = Math.cos(t) * radius;
      camera.position.y = height;
      controlsRef.current.target.set(0, 1.8, 0);
      controlsRef.current.update();
      return;
    }

    // Smooth lerp transition to new preset
    if (isTransitioningRef.current) {
      camera.position.lerp(targetPosRef.current, delta * 4.5);
      controlsRef.current.target.lerp(targetLookRef.current, delta * 4.5);

      if (camera.position.distanceTo(targetPosRef.current) < 0.05) {
        camera.position.copy(targetPosRef.current);
        controlsRef.current.target.copy(targetLookRef.current);
        isTransitioningRef.current = false;
      }
    }

    // Update controls for smooth damping
    controlsRef.current.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      minDistance={3.2 * (isPortrait ? 1.25 : 1.0)}
      maxDistance={12.5} // Prevents clipping outside room walls
      minPolarAngle={0.22} // Allows looking smoothly up towards the chandeliers and ceiling
      maxPolarAngle={1.54} // Locks at floor level; camera never penetrates floor
      enablePan={false} // Smooth locked orbital rotation around center of chessboard
      rotateSpeed={isMobile ? 0.6 : 0.8}
      zoomSpeed={0.8}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  );
};
