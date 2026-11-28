import React from 'react';
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
  // Pure isolated subscriber — ticking is driven once centrally in GameHUD so dual mobile/desktop instances never double-count time.
  const timeMs = useGameStore((s) => (color === 'w' ? s.whiteTimeMs : s.blackTimeMs));
  const timeControl = useGameStore((s) => s.timeControl);

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
      className={`relative flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition-all duration-300 ${isActive
        ? 'bg-[#c6a45c]/15 border-2 border-[#c6a45c] shadow-glow-gold'
        : 'bg-white/80 border border-[#d6d6d2]'
        } ${isCritical && isActive ? 'animate-pulse bg-red-100 border-red-500' : ''}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div
          className={`w-3.5 h-3.5 rounded-full border shadow-sm shrink-0 ${color === 'w' ? 'bg-[#f7f7f4] border-[#bfc1c2]' : 'bg-[#202226] border-black'
            }`}
        />
        <div className="flex flex-col min-w-0 flex-1">
          {playerName && (
            <span className="text-xs font-serif font-bold text-[#202226] truncate block">
              {playerName}
            </span>
          )}
          <span className="text-[10px] text-[#666762] uppercase tracking-wider font-semibold">
            {color === 'w' ? 'White' : 'Black'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 font-mono text-sm xl:text-base font-bold shrink-0">
        <Clock
          className={`w-3.5 h-3.5 ${isActive ? (isLowTime ? 'text-red-500' : 'text-[#c6a45c]') : 'text-[#a7a8a5]'
            }`}
        />
        <span
          className={`${isCritical
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
