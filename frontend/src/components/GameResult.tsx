import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useGameStore } from '../store/gameStore';
import { Trophy, RefreshCw, Home, XCircle, Minus, Search } from 'lucide-react';

export const GameResult: React.FC = () => {
  const gameResult = useGameStore((s) => s.gameResult);
  const playerColor = useGameStore((s) => s.playerColor);
  const history = useGameStore((s) => s.history) || [];
  const isReviewingGame = useGameStore((s) => s.isReviewingGame);
  const enterReviewMode = useGameStore((s) => s.enterReviewMode);
  const resetGame = useGameStore((s) => s.resetGame);
  const returnToMenu = useGameStore((s) => s.returnToMenu);

  const isOver = !!gameResult?.isOver;
  const isWinner = isOver && gameResult.winner === playerColor;
  const isDraw = isOver && gameResult.winner === 'draw';

  // Fire celebratory confetti on victory (Hook placed unconditionally at top level)
  useEffect(() => {
    if (isWinner) {
      try {
        confetti({
          particleCount: 130,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#c6a45c', '#f7f7f4', '#bfc1c2', '#a7a8a5'],
        });
      } catch (e) {
        // Safe fallback
      }
    }
  }, [isWinner]);

  if (!gameResult || !gameResult.isOver || isReviewingGame) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-[#f7f7f4] border border-[#c6a45c]/40 rounded-3xl p-5 sm:p-8 shadow-2xl text-center text-[#202226] max-h-[90dvh] overflow-y-auto">
        {/* Result Icon */}
        <div className="mb-4 inline-flex items-center justify-center">
          {isWinner ? (
            <div className="p-4 rounded-full bg-[#c6a45c]/15 border-2 border-[#c6a45c] text-[#c6a45c] shadow-glow-gold animate-bounce">
              <Trophy className="w-12 h-12" />
            </div>
          ) : isDraw ? (
            <div className="p-4 rounded-full bg-[#666762]/10 border-2 border-[#a7a8a5] text-[#666762]">
              <Minus className="w-12 h-12" />
            </div>
          ) : (
            <div className="p-4 rounded-full bg-red-100 border-2 border-red-500 text-red-600">
              <XCircle className="w-12 h-12" />
            </div>
          )}
        </div>

        {/* Heading */}
        <h2 className="text-2xl sm:text-3xl font-serif font-extrabold tracking-wide text-[#202226] mb-1">
          {isWinner ? 'ROYAL VICTORY' : isDraw ? 'HONORABLE DRAW' : 'DEFEAT'}
        </h2>

        <div className="text-[#c6a45c] text-sm font-serif font-bold tracking-wider uppercase mb-2">
          {gameResult.title}
        </div>

        <p className="text-xs text-[#666762] max-w-xs mx-auto mb-6">
          {gameResult.details}
        </p>

        {/* Match Statistics Card */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-white border border-[#d6d6d2] mb-6 text-left text-xs shadow-sm">
          <div>
            <span className="text-[#a7a8a5] block text-[10px] uppercase tracking-wider font-semibold">Total Moves</span>
            <span className="text-base font-bold text-[#202226] font-mono">
              {Math.ceil(history.length / 2)} moves ({history.length} ply)
            </span>
          </div>
          <div>
            <span className="text-[#a7a8a5] block text-[10px] uppercase tracking-wider font-semibold">Playing As</span>
            <span className="text-base font-serif font-bold text-[#c6a45c]">
              {playerColor === 'w' ? 'White' : 'Black'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          {history.length > 0 && (
            <button
              onClick={enterReviewMode}
              className="w-full py-2.5 rounded-xl bg-[#202226] hover:bg-[#32353b] text-[#f7f7f4] font-serif font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-sm"
            >
              <Search className="w-4 h-4 text-[#c6a45c]" />
              <span>
                {gameResult.title === 'Checkmate' ? 'Review Checkmate & Mistakes' : 'Review Board'}
              </span>
            </button>
          )}

          <button
            onClick={resetGame}
            className="w-full py-3 rounded-xl bg-[#c6a45c] hover:bg-[#b5934a] text-white font-serif font-bold text-xs uppercase tracking-wider transition-all shadow-glow-gold flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Play Again</span>
          </button>

          <button
            onClick={returnToMenu}
            className="w-full py-2.5 rounded-xl bg-white hover:bg-gray-100 border border-[#d6d6d2] text-[#202226] font-serif font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4 text-[#c6a45c]" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
