import React, { Suspense, useEffect, useState, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from '../components/RoomEnvironment';
import { ChessBoard3D } from '../components/ChessBoard3D';
import { CameraController } from '../components/CameraController';
import { useGameStore, checkIsMobile } from '../store/gameStore';
import { detectDeviceCapabilities } from '../utils/deviceTier';

/**
 * Adaptive Performance Watcher (Safe for both 'always' and 'demand' render loops)
 * Measures active sustained frame rate over 1.0s windows (ignoring idle demand gaps).
 * If sustained active FPS stays below 30 FPS across 2 consecutive windows (~2-3s),
 * smoothly degrades graphics tier to preserve responsiveness without sudden visual popping.
 */
const AdaptivePerformanceWatcher: React.FC = () => {
  const adaptiveQualityDegrade = useGameStore((s) => s.adaptiveQualityDegrade);
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const lowFpsStreakRef = useRef(0);
  const accumTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const warmupRef = useRef(1.2);

  useEffect(() => {
    warmupRef.current = 1.0;
    lowFpsStreakRef.current = 0;
    accumTimeRef.current = 0;
    frameCountRef.current = 0;
  }, [graphicsQuality]);

  useFrame((_, delta) => {
    if (graphicsQuality === 'low') return;
    // Ignore idle demand-mode gaps, tab-switches, or background stalls
    if (delta > 0.25) return;

    if (warmupRef.current > 0) {
      warmupRef.current -= delta;
      return;
    }

    accumTimeRef.current += delta;
    frameCountRef.current += 1;

    if (accumTimeRef.current >= 1.0) {
      const avgFps = frameCountRef.current / accumTimeRef.current;
      const sampleCount = frameCountRef.current;
      accumTimeRef.current = 0;
      frameCountRef.current = 0;

      // Require >= 8 active frames in the window so sparse demand wakeups don't skew FPS
      if (sampleCount >= 8 && avgFps < 30) {
        lowFpsStreakRef.current += 1;
        if (lowFpsStreakRef.current >= 2) {
          adaptiveQualityDegrade();
          lowFpsStreakRef.current = 0;
        }
      } else if (sampleCount >= 8) {
        lowFpsStreakRef.current = Math.max(0, lowFpsStreakRef.current - 1);
      }
    }
  });

  return null;
};

/**
 * Dynamically configures WebGL ShadowMap type & invalidates on quality shifts
 */
const RendererTuner: React.FC<{ useSoftShadows: boolean; graphicsQuality: string }> = ({
  useSoftShadows,
  graphicsQuality,
}) => {
  const { gl, invalidate } = useThree();

  useEffect(() => {
    const desiredType = useSoftShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (gl.shadowMap.type !== desiredType) {
      gl.shadowMap.type = desiredType;
      gl.shadowMap.needsUpdate = true;
    }
    invalidate();
  }, [gl, useSoftShadows, graphicsQuality, invalidate]);

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

  // Tab visibility management: pause rendering when backgrounded to conserve battery & prevent throttling
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

  const caps = useMemo(() => detectDeviceCapabilities(), []);
  const isTouchOrMobile = caps.isTouch || isMobile;

  // Tightly calibrated DPR & GPU pixel budget per tier (protects mobile fillrate & Desktop-Mode mobile browsers)
  const dpr: [number, number] = useMemo(() => {
    const w = Math.max(320, viewportSize.w);
    const h = Math.max(320, viewportSize.h);
    const nativeDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    let maxPixelBudget = 2.0e6;
    let targetMaxDpr = 1.25;

    if (graphicsQuality === 'low') {
      maxPixelBudget = isTouchOrMobile ? 0.85e6 : 1.4e6;
      targetMaxDpr = 1.0;
    } else if (graphicsQuality === 'medium') {
      maxPixelBudget = isTouchOrMobile ? 1.35e6 : 2.0e6;
      targetMaxDpr = isTouchOrMobile ? 1.15 : 1.25;
    } else if (graphicsQuality === 'high') {
      maxPixelBudget = isTouchOrMobile ? 1.85e6 : 3.0e6;
      targetMaxDpr = isTouchOrMobile ? 1.35 : 1.5;
    } else {
      maxPixelBudget = isTouchOrMobile ? 2.2e6 : 4.0e6;
      targetMaxDpr = isTouchOrMobile ? 1.5 : 2.0;
    }

    const desiredDpr = Math.min(nativeDpr, targetMaxDpr);
    const pixels = w * h * desiredDpr * desiredDpr;
    if (pixels > maxPixelBudget) {
      const clamped = Math.sqrt(maxPixelBudget / (w * h));
      return [1, Math.max(1.0, Number(Math.min(desiredDpr, clamped).toFixed(2)))];
    }

    return [1, Number(desiredDpr.toFixed(2))];
  }, [isTouchOrMobile, graphicsQuality, viewportSize.w, viewportSize.h]);

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
  // Disable heavy MSAA on Performance ('low') and touch Balanced ('medium') to prevent tile-GPU stalls
  const useAntialias =
    graphicsQuality === 'high' || graphicsQuality === 'ultra' || (!isTouchOrMobile && graphicsQuality !== 'low');
  // Demand rendering across ALL tiers eliminates idle GPU queue saturation & keeps click interactions < 50ms
  // while camera orbit, transitions, piece damp animations, and chandelier dimming wake instantaneously via invalidate().
  return (
    <div className="absolute inset-0 w-full h-full select-none overflow-hidden bg-[#141518] touch-none">
      <Canvas
        frameloop={!isTabVisible || contextLost ? 'never' : 'demand'}
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
        <RendererTuner useSoftShadows={useSoftShadows} graphicsQuality={graphicsQuality} />
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
