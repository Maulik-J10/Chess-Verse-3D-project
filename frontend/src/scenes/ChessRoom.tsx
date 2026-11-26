import React, { Suspense, useEffect, useState, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from '../components/RoomEnvironment';
import { ChessBoard3D } from '../components/ChessBoard3D';
import { CameraController } from '../components/CameraController';
import { useGameStore, checkIsMobile } from '../store/gameStore';
import { detectDeviceCapabilities } from '../utils/deviceTier';

/**
 * Adaptive Performance Watcher (Fixed rolling delta accumulator — zero Clock side-effects)
 * Evaluates actual sustained FPS across 1.5s windows. If average FPS stays below 28 FPS
 * across 3 consecutive windows (~4.5s), smoothly degrades graphics profile to protect smoothness.
 */
const AdaptivePerformanceWatcher: React.FC = () => {
  const adaptiveQualityDegrade = useGameStore((s) => s.adaptiveQualityDegrade);
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const lowFpsStreakRef = useRef(0);
  const accumTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const warmupRef = useRef(2.0); // Skip first 2s of initial shader compile

  useEffect(() => {
    warmupRef.current = 1.5;
    lowFpsStreakRef.current = 0;
    accumTimeRef.current = 0;
    frameCountRef.current = 0;
  }, [graphicsQuality]);

  useFrame((_, delta) => {
    if (graphicsQuality === 'low') return;
    // Ignore tab-switch or huge stall spikes when deciding sustained FPS
    if (delta > 0.25) return;

    if (warmupRef.current > 0) {
      warmupRef.current -= delta;
      return;
    }

    accumTimeRef.current += delta;
    frameCountRef.current += 1;

    if (accumTimeRef.current >= 1.5) {
      const avgFps = frameCountRef.current / accumTimeRef.current;
      accumTimeRef.current = 0;
      frameCountRef.current = 0;

      if (avgFps < 28) {
        lowFpsStreakRef.current += 1;
        if (lowFpsStreakRef.current >= 3) {
          adaptiveQualityDegrade();
          lowFpsStreakRef.current = 0;
        }
      } else {
        lowFpsStreakRef.current = Math.max(0, lowFpsStreakRef.current - 1);
      }
    }
  });

  return null;
};

/**
 * Dynamically configures WebGL ShadowMap type & resource hints without recreating Canvas
 */
const RendererTuner: React.FC<{ useSoftShadows: boolean }> = ({ useSoftShadows }) => {
  const { gl } = useThree();

  useEffect(() => {
    const desiredType = useSoftShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (gl.shadowMap.type !== desiredType) {
      gl.shadowMap.type = desiredType;
      gl.shadowMap.needsUpdate = true;
    }
  }, [gl, useSoftShadows]);

  return null;
};

export const ChessRoom: React.FC = () => {
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const isMobile = useGameStore((s) => s.isMobile);
  const setIsMobile = useGameStore((s) => s.setIsMobile);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const [viewportSize, setViewportSize] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));

  const canvasDomRef = useRef<HTMLCanvasElement | null>(null);
  const contextCleanupRef = useRef<(() => void) | null>(null);

  // Monitor resize & orientation changes cleanly
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(checkIsMobile());
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [setIsMobile]);

  // Tab visibility management: pause rendering when backgrounded to conserve battery & avoid throttling
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Cleanup WebGL context listeners on unmount
  useEffect(() => {
    return () => {
      if (contextCleanupRef.current) {
        contextCleanupRef.current();
        contextCleanupRef.current = null;
      }
    };
  }, []);

  // Compute safe DPR bounded by both device capability & total GPU pixel budget
  // (prevents 3x mobile OLED screens or "Desktop Site" mode from exploding fillrate)
  const dpr: [number, number] = useMemo(() => {
    const caps = detectDeviceCapabilities();
    const isTouchOrMobile = caps.isTouch || isMobile;
    const w = Math.max(320, viewportSize.w);
    const h = Math.max(320, viewportSize.h);
    const nativeDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    let maxPixelBudget = 2.2e6;
    let targetMaxDpr = 1.2;

    if (graphicsQuality === 'low') {
      maxPixelBudget = isTouchOrMobile ? 1.1e6 : 1.6e6;
      targetMaxDpr = 1.0;
    } else if (graphicsQuality === 'medium') {
      maxPixelBudget = isTouchOrMobile ? 1.65e6 : 2.2e6;
      targetMaxDpr = isTouchOrMobile ? 1.15 : 1.25;
    } else if (graphicsQuality === 'high') {
      maxPixelBudget = isTouchOrMobile ? 2.2e6 : 3.2e6;
      targetMaxDpr = isTouchOrMobile ? 1.35 : 1.5;
    } else {
      maxPixelBudget = isTouchOrMobile ? 2.4e6 : 4.0e6;
      targetMaxDpr = isTouchOrMobile ? 1.5 : 2.0;
    }

    const desiredDpr = Math.min(nativeDpr, targetMaxDpr);
    const pixels = w * h * desiredDpr * desiredDpr;
    if (pixels > maxPixelBudget) {
      const clamped = Math.sqrt(maxPixelBudget / (w * h));
      return [1, Math.max(1.0, Number(Math.min(desiredDpr, clamped).toFixed(2)))];
    }

    return [1, Number(desiredDpr.toFixed(2))];
  }, [isMobile, graphicsQuality, viewportSize.w, viewportSize.h]);

  const handleCreated = ({ gl }: { gl: THREE.WebGLRenderer }) => {
    const canvas = gl.domElement;
    canvasDomRef.current = canvas;
    if (contextCleanupRef.current) {
      contextCleanupRef.current();
    }
    const handleLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleRestored = () => {
      setContextLost(false);
    };
    canvas.addEventListener('webglcontextlost', handleLost, false);
    canvas.addEventListener('webglcontextrestored', handleRestored, false);
    contextCleanupRef.current = () => {
      canvas.removeEventListener('webglcontextlost', handleLost, false);
      canvas.removeEventListener('webglcontextrestored', handleRestored, false);
    };
  };

  const shadowEnabled = graphicsQuality !== 'low';
  const useSoftShadows = graphicsQuality === 'high' || graphicsQuality === 'ultra';
  const useAntialias = graphicsQuality === 'high' || graphicsQuality === 'ultra' || (!isMobile && graphicsQuality !== 'low');

  return (
    <div className="absolute inset-0 w-full h-full select-none overflow-hidden bg-[#141518] touch-none">
      <Canvas
        frameloop={isTabVisible && !contextLost ? 'always' : 'never'}
        shadows={shadowEnabled}
        dpr={dpr}
        camera={{ position: [0, 4.25, 7.6], fov: 56, near: 0.25, far: 85 }}
        onCreated={handleCreated}
        gl={{
          antialias: useAntialias,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
      >
        <color attach="background" args={['#141518']} />
        <RendererTuner useSoftShadows={useSoftShadows} />
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
