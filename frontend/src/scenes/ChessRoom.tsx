import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from '../components/RoomEnvironment';
import { ChessBoard3D } from '../components/ChessBoard3D';
import { CameraController } from '../components/CameraController';
import { useGameStore } from '../store/gameStore';

export const ChessRoom: React.FC = () => {
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);

  const shadowEnabled = graphicsQuality !== 'low';
  const dpr =
    graphicsQuality === 'low'
      ? 1
      : graphicsQuality === 'medium'
        ? 1.25
        : graphicsQuality === 'high'
          ? 1.5
          : 2;

  return (
    <div className="absolute inset-0 w-full h-full select-none overflow-hidden bg-[#eeede8]">
      <Canvas
        shadows={shadowEnabled}
        dpr={dpr}
        camera={{ position: [0, 4.25, 7.6], fov: 56 }}
        gl={{
          antialias: graphicsQuality !== 'low',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
          powerPreference: 'high-performance',
        }}
      >
        <Suspense fallback={null}>
          <RoomEnvironment />
          <ChessBoard3D />
          <CameraController />
        </Suspense>
      </Canvas>
    </div>
  );
};
