import React from 'react';
import { PieceType } from '../chess/types';

interface CapturedPiecesProps {
  captured: PieceType[];
  advantage?: number;
}

const PIECE_SYMBOLS: Record<PieceType, string> = {
  p: '♟',
  n: '♞',
  b: '♝',
  r: '♜',
  q: '♛',
  k: '♚',
};

export const CapturedPieces: React.FC<CapturedPiecesProps> = ({ captured, advantage = 0 }) => {
  const order: Record<PieceType, number> = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
  const sorted = [...captured].sort((a, b) => order[a] - order[b]);

  return (
    <div className="flex items-center gap-1 min-h-[22px] overflow-x-auto py-0.5 select-none text-xs">
      <div className="flex items-center space-x-0.5 text-[#202226]">
        {sorted.map((type, idx) => (
          <span key={idx} className="text-sm opacity-85" title={type.toUpperCase()}>
            {PIECE_SYMBOLS[type]}
          </span>
        ))}
      </div>

      {advantage > 0 && (
        <span className="ml-1 text-[11px] font-bold text-[#c6a45c] px-1.5 py-0.2 rounded bg-[#c6a45c]/15 border border-[#c6a45c]/30">
          +{advantage}
        </span>
      )}
    </div>
  );
};
