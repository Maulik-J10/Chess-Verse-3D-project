import React from 'react';
import { Cpu } from 'lucide-react';

interface ThinkingIndicatorProps {
  difficulty: string;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ difficulty }) => {
  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#f7f7f4] border border-[#c6a45c]/50 backdrop-blur-md shadow-glow-gold animate-pulse text-[#202226] text-xs font-serif font-semibold">
      <div className="relative flex items-center justify-center">
        <Cpu className="w-4 h-4 animate-spin text-[#c6a45c]" />
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#c6a45c] animate-ping" />
      </div>
      <span>Computer is calculating...</span>
      <span className="text-[10px] text-[#c6a45c] uppercase font-mono px-2 py-0.5 rounded bg-[#c6a45c]/10 border border-[#c6a45c]/30 font-bold">
        {difficulty}
      </span>
    </div>
  );
};
