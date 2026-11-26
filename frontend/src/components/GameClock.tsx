import React, { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { Clock } from 'lucide-react';
import { PieceColor } from '../chess/types';

interface GameClockProps {
  color: PieceColor;
  isActive: boolean;
  playerName: string;
}

export const GameClock: React.FC<GameClockProps> = ({
  color,
  isActive,
  playerName,
}) => {
  // Isolate time subscription directly inside GameClock so ticking NEVER re-renders the whole GameHUD!
  const timeMs = useGameStore((s) => (color === 'w' ? s.whiteTimeMs : s.blackTimeMs));
  const tickClock = useGameStore((s) => s.tickClock);
  const isClockRunning = useGameStore((s) => s.isClockRunning);
  const timeControl = useGameStore((s) => s.timeControl);

  const isUnderTenSec = timeControl.minutes > 0 && timeMs <= 10500;

  // Periodic ticker for active clock (250ms normally -> 4x fewer updates; 100ms under 10s for crisp tenths)
  useEffect(() => {
    if (!isActive || !isClockRunning || timeControl.minutes === 0) return;

    const intervalMs = isUnderTenSec ? 100 : 250;
    const interval = setInterval(() => {
      tickClock(intervalMs);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isActive, isClockRunning, timeControl.minutes, isUnderTenSec, tickClock]);

  const formatTime = (ms: number): string => {
    if (timeControl.minutes === 0) return '∞';
    const totalSecs = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;

    if (totalSecs < 10) {
      const tenths = Math.floor((ms % 1000) / 100);
      return `${mins}:${secs < 10 ? '0' : ''}${secs}.${tenths}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const isLowTime = timeControl.minutes > 0 && timeMs <= 20000;
  const isCritical = timeControl.minutes > 0 && timeMs <= 10000;

  return (
    <div
      className={`relative flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-300 ${
        isActive
          ? 'bg-[#c6a45c]/15 border-2 border-[#c6a45c] shadow-glow-gold'
          : 'bg-white/80 border border-[#d6d6d2]'
      } ${isCritical && isActive ? 'animate-pulse bg-red-100 border-red-500' : ''}`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-3.5 h-3.5 rounded-full border shadow-sm ${
            color === 'w' ? 'bg-[#f7f7f4] border-[#bfc1c2]' : 'bg-[#202226] border-black'
          }`}
        />
        <div className="flex flex-col">
          {playerName && (
            <span className="text-xs font-serif font-bold text-[#202226] truncate max-w-[110px]">
              {playerName}
            </span>
          )}
          <span className="text-[10px] text-[#666762] uppercase tracking-wider font-semibold">
            {color === 'w' ? 'White' : 'Black'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 font-mono text-base font-bold">
        <Clock
          className={`w-3.5 h-3.5 ${
            isActive ? (isLowTime ? 'text-red-500' : 'text-[#c6a45c]') : 'text-[#a7a8a5]'
          }`}
        />
        <span
          className={`${
            isCritical
              ? 'text-red-600'
              : isLowTime
              ? 'text-amber-600'
              : isActive
              ? 'text-[#202226]'
              : 'text-[#666762]'
          }`}
        >
          {formatTime(timeMs)}
        </span>
      </div>
    </div>
  );
};
