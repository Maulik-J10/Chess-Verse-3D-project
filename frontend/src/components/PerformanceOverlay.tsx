import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { Activity, X } from 'lucide-react';

export const PerformanceOverlay: React.FC = () => {
  const showPerfOverlay = useGameStore((s) => s.showPerfOverlay);
  const togglePerfOverlay = useGameStore((s) => s.togglePerfOverlay);
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);

  const [fps, setFps] = useState(60);
  const [frameTime, setFrameTime] = useState(16.6);
  const [dpr, setDpr] = useState(1);
  const [resolution, setResolution] = useState('');

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafIdRef = useRef<number>(0);

  useEffect(() => {
    if (!showPerfOverlay) return;

    setDpr(window.devicePixelRatio || 1);
    setResolution(`${window.innerWidth} × ${window.innerHeight}`);

    const handleResize = () => {
      setResolution(`${window.innerWidth} × ${window.innerHeight}`);
    };
    window.addEventListener('resize', handleResize);

    const loop = (now: number) => {
      frameCountRef.current += 1;
      const elapsed = now - lastTimeRef.current;

      if (elapsed >= 1000) {
        const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
        const currentFrameTime = +(elapsed / frameCountRef.current).toFixed(1);
        setFps(currentFps);
        setFrameTime(currentFrameTime);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [showPerfOverlay]);

  if (!showPerfOverlay) return null;

  const fpsColor =
    fps >= 55 ? 'text-emerald-400' : fps >= 30 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="fixed top-20 right-4 z-50 pointer-events-auto bg-[#121316]/90 backdrop-blur-md border border-[#c6a45c]/40 rounded-2xl p-3 text-[11px] font-mono text-white shadow-2xl min-w-[200px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
        <div className="flex items-center gap-1.5 text-[#c6a45c] font-bold">
          <Activity className="w-3.5 h-3.5" />
          <span>PERF MONITOR</span>
        </div>
        <button
          onClick={togglePerfOverlay}
          className="text-white/50 hover:text-white p-0.5 rounded cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-white/60">FPS:</span>
          <span className={`font-bold ${fpsColor}`}>{fps} FPS</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-white/60">Frame Time:</span>
          <span className="text-white/90">{frameTime} ms</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-white/60">Profile:</span>
          <span className="text-[#c6a45c] uppercase font-bold">{graphicsQuality}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-white/60">Device DPR:</span>
          <span className="text-white/90">{dpr}x</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-white/60">Viewport:</span>
          <span className="text-white/90">{resolution}</span>
        </div>
      </div>
    </div>
  );
};
