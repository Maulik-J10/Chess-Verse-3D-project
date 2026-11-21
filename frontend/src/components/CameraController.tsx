import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { CameraPreset } from '../chess/types';

// Preset Camera Coordinates calibrated for Grand Chess Room
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
  const { camera } = useThree();

  const cameraPreset = useGameStore((s) => s.cameraPreset);
  const isFlipped = useGameStore((s) => s.isFlipped);

  // Target positions for smooth lerping
  const targetPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 4.3, 7.8));
  const targetLookRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.8, 0));
  const isTransitioningRef = useRef(false);

  // When cameraPreset changes, trigger transition
  useEffect(() => {
    let cfg = PRESET_CONFIGS[cameraPreset] || PRESET_CONFIGS.front;

    if (isFlipped) {
      if (cameraPreset === 'white') cfg = PRESET_CONFIGS.black;
      else if (cameraPreset === 'black') cfg = PRESET_CONFIGS.white;
    }

    targetPosRef.current.set(...cfg.pos);
    targetLookRef.current.set(...cfg.target);
    isTransitioningRef.current = true;
  }, [cameraPreset, isFlipped]);

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    // Cinematic continuous slow panoramic sweep around the gallery
    if (cameraPreset === 'cinematic') {
      const t = state.clock.getElapsedTime() * 0.12;
      const radius = 8.5;
      const height = 4.2 + Math.sin(t * 0.5) * 0.5;
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
      dampingFactor={0.06}
      minDistance={3.2}
      maxDistance={11.0} // Prevents clipping outside room walls
      minPolarAngle={0.22} // Allows looking smoothly up towards the chandeliers and ceiling
      maxPolarAngle={1.54} // Locks at floor level; camera never penetrates floor
      enablePan={false} // Smooth locked orbital rotation around center of chessboard
      rotateSpeed={0.8}
    />
  );
};
