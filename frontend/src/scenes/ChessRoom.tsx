import React, { Suspense, useEffect, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from '../components/RoomEnvironment';
import { ChessBoard3D } from '../components/ChessBoard3D';
import { CameraController } from '../components/CameraController';
import { useGameStore, checkIsMobile } from '../store/gameStore';

/**
 * Adaptive Performance Watcher
 * Smoothly monitors frame time on mobile/low-end devices.
 * If frame rate stays below 28 FPS for 4+ consecutive seconds,
 * gracefully steps down graphics profile to preserve responsiveness.
 */
const AdaptivePerformanceWatcher: React.FC = () => {
  const adaptiveQualityDegrade = useGameStore((s) => s.adaptiveQualityDegrade);
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const lowFpsCountRef = useRef(0);
  const lastCheckTimeRef = useRef(0);

  useFrame((state) => {
    // Only monitor if not already at lowest profile
    if (graphicsQuality === 'low') return;

    const time = state.clock.getElapsedTime();
    if (time - lastCheckTimeRef.current > 1.0) {
      lastCheckTimeRef.current = time;
      // Normal frame interval at 60fps is ~16ms (0.016s); 28fps is ~35ms
      const delta = state.clock.getDelta();
      if (delta > 0.038) {
        lowFpsCountRef.current += 1;
        if (lowFpsCountRef.current >= 4) {
          adaptiveQualityDegrade();
          lowFpsCountRef.current = 0;
        }
      } else {
        lowFpsCountRef.current = Math.max(0, lowFpsCountRef.current - 1);
      }
    }
  });

  return null;
};

export const ChessRoom: React.FC = () => {
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const isMobile = useGameStore((s) => s.isMobile);
  const setIsMobile = useGameStore((s) => s.setIsMobile);
  const [isTabVisible, setIsTabVisible] = useState(true);

  // Monitor resize & orientation changes
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(checkIsMobile());
    };
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [setIsMobile]);

  // Tab visibility management: pause rendering when tab is hidden to save mobile battery
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Compute DPR safely clamped: guarantees mobile hardware and desktop-mode never exceed GPU fillrate
  const dpr: [number, number] = React.useMemo(() => {
    const isTouch =
      typeof window !== 'undefined' &&
      (navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const h = typeof window !== 'undefined' ? window.innerHeight : 720;
    const nativeDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    // Hard ceiling on total rendered pixels to prevent GPU memory saturation / freezes:
    // Touch/mobile devices (including desktop-mode on phones): max 2.2 million pixels
    // Real desktop PCs: up to 4.0 million pixels
    const maxPixelBudget = isTouch ? 2.2e6 : 4.0e6;

    let targetDpr = 1.0;
    if (isTouch || isMobile) {
      if (graphicsQuality === 'low') targetDpr = 1.0;
      else if (graphicsQuality === 'medium') targetDpr = 1.15;
      else if (graphicsQuality === 'high') targetDpr = 1.35;
      else targetDpr = 1.5;
    } else {
      if (graphicsQuality === 'low') targetDpr = 1.0;
      else if (graphicsQuality === 'medium') targetDpr = 1.25;
      else if (graphicsQuality === 'high') targetDpr = 1.5;
      else targetDpr = 2.0;
    }

    const effectiveDpr = Math.min(nativeDpr, targetDpr);
    const totalPixels = w * h * effectiveDpr * effectiveDpr;

    if (totalPixels > maxPixelBudget) {
      const clamped = Math.sqrt(maxPixelBudget / (w * h));
      const finalMax = Math.max(1.0, Math.min(clamped, effectiveDpr));
      return [1, Number(finalMax.toFixed(2))];
    }

    return [1, Number(effectiveDpr.toFixed(2))];
  }, [isMobile, graphicsQuality]);

  // Handle WebGL context recovery to prevent black screen / freeze after memory pressure
  const handleCreated = ({ gl }: { gl: THREE.WebGLRenderer }) => {
    const canvas = gl.domElement;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('ChessVerse: WebGL context lost. Pausing until GPU restores.');
    };
    const handleContextRestored = () => {
      console.info('ChessVerse: WebGL context restored.');
    };
    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
  };

  // Shadows enabled by default on desktop; on mobile enabled for medium/high/ultra
  const shadowEnabled = graphicsQuality !== 'low';

  return (
    <div className="absolute inset-0 w-full h-full select-none overflow-hidden bg-[#eeede8] touch-none">
      <Canvas
        frameloop={isTabVisible ? 'always' : 'never'}
        shadows={shadowEnabled}
        dpr={dpr}
        camera={{ position: [0, 4.25, 7.6], fov: 56 }}
        onCreated={handleCreated}
        gl={{
          antialias: graphicsQuality !== 'low',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
      >
        <Suspense fallback={null}>
          <RoomEnvironment />
          <ChessBoard3D />
          <CameraController />
          <AdaptivePerformanceWatcher />
        </Suspense>
      </Canvas>
    </div>
  );
};
