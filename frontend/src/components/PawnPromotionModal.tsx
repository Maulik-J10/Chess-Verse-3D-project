import React from 'react';
import { useGameStore } from '../store/gameStore';
import { PieceType } from '../chess/types';
import { Crown, Castle, Shield, Sparkles } from 'lucide-react';

export const PawnPromotionModal: React.FC = () => {
  const promotionPending = useGameStore((s) => s.promotionPending);
  const executePromotion = useGameStore((s) => s.executePromotion);
  const cancelPromotion = useGameStore((s) => s.cancelPromotion);

  if (!promotionPending) return null;

  const pieces: { type: PieceType; name: string; icon: React.ReactNode; desc: string }[] = [
    { type: 'q', name: 'Queen', icon: <Crown className="w-8 h-8 text-[#c6a45c]" />, desc: 'Diagonal & Straight' },
    { type: 'r', name: 'Rook', icon: <Castle className="w-8 h-8 text-[#666762]" />, desc: 'Straight Lines' },
    { type: 'b', name: 'Bishop', icon: <Sparkles className="w-8 h-8 text-[#c6a45c]" />, desc: 'Diagonals' },
    { type: 'n', name: 'Knight', icon: <Shield className="w-8 h-8 text-[#202226]" />, desc: 'L-Shape Leap' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-3 sm:p-4">
      <div className="relative w-full max-w-md bg-[#f7f7f4] border border-[#c6a45c]/40 rounded-3xl p-5 sm:p-8 shadow-2xl text-center text-[#202226] max-h-[90dvh] overflow-y-auto">
        <h3 className="text-xl font-serif font-bold text-[#202226] tracking-wider mb-2">
          PAWN PROMOTION
        </h3>
        <p className="text-xs text-[#666762] mb-6">
          Your pawn has reached the final rank. Choose which royal piece to promote to:
        </p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {pieces.map((p) => (
            <button
              key={p.type}
              onClick={() => executePromotion(p.type)}
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-[#d6d6d2] hover:border-[#c6a45c] hover:bg-[#c6a45c]/5 transition-all duration-200 group active:scale-95 cursor-pointer shadow-sm"
            >
              <div className="p-3 rounded-full bg-[#eeede8] mb-2 group-hover:scale-110 transition-transform">
                {p.icon}
              </div>
              <span className="font-serif font-bold text-sm text-[#202226] group-hover:text-[#c6a45c]">
                {p.name}
              </span>
              <span className="text-[11px] text-[#a7a8a5] mt-0.5">{p.desc}</span>
            </button>
          ))}
        </div>

        <button
          onClick={cancelPromotion}
          className="text-xs text-[#666762] hover:text-[#202226] transition-colors uppercase tracking-wider underline cursor-pointer"
        >
          Cancel Move
        </button>
      </div>
    </div>
  );
};
