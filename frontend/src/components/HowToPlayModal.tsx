import React from 'react';
import { BookOpen, X, Shield, Compass, Sparkles, CheckCircle2 } from 'lucide-react';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#f7f7f4] border border-[#c6a45c]/40 rounded-3xl p-4 sm:p-8 shadow-2xl text-[#202226] max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#c6a45c]/20 mb-5 sticky top-0 bg-[#f7f7f4]/95 backdrop-blur z-10">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#c6a45c]" />
            <h3 className="text-xl font-serif font-bold text-[#202226]">HOW TO PLAY CHESS</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 text-[#666762] hover:text-[#202226] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 text-xs text-[#666762]">
          {/* Piece Movements */}
          <section>
            <h4 className="text-sm font-bold text-[#c6a45c] font-serif mb-3 flex items-center gap-1.5">
              <Shield className="w-4 h-4" />
              Standard Piece Movements
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-sm text-[#202226] block mb-0.5">♙ Pawn</span>
                Advances 1 square forward (or 2 squares on its very first move). Captures diagonally 1 square ahead.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-sm text-[#202226] block mb-0.5">♖ Rook</span>
                Moves any number of unobstructed squares horizontally or vertically.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-sm text-[#202226] block mb-0.5">♘ Knight</span>
                Moves in an "L-shape" (2 squares along one axis, 1 square perpendicular). Can leap over any intervening pieces!
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-sm text-[#202226] block mb-0.5">♗ Bishop</span>
                Moves any number of unobstructed squares diagonally along its color complex.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-sm text-[#202226] block mb-0.5">♕ Queen</span>
                Combines the lethal power of both Rook and Bishop in any direction.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-sm text-[#202226] block mb-0.5">♔ King</span>
                Moves 1 square in any direction. The most vital piece; must never enter check!
              </div>
            </div>
          </section>

          {/* Special Rules */}
          <section>
            <h4 className="text-sm font-bold text-[#c6a45c] font-serif mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Special FIDE Chess Rules
            </h4>
            <div className="space-y-2.5">
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-[#202226]">Castling (O-O / O-O-O):</span> The King moves two squares toward a Rook, and the Rook leaps over to the adjacent square. Permitted only if neither piece has moved, the path is clear, and the King is neither in check nor crossing attacked squares.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-[#202226]">En Passant:</span> When an enemy pawn advances two squares past your pawn on the 5th rank, your pawn can capture it diagonally behind as if it had only moved one square.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-[#202226]">Pawn Promotion:</span> When a pawn advances to the 8th rank, it immediately transforms into a Queen, Rook, Bishop, or Knight of the player's choice.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-[#202226]">Checkmate vs Stalemate:</span> If the King is attacked and cannot escape, it is Checkmate (Victory!). If a player has no legal moves but is NOT in check, it is Stalemate (Draw!).
              </div>
            </div>
          </section>

          {/* Camera & 3D Navigation */}
          <section>
            <h4 className="text-sm font-bold text-[#c6a45c] font-serif mb-3 flex items-center gap-1.5">
              <Compass className="w-4 h-4" />
              360° 3D Camera Controls
            </h4>
            <div className="p-4 rounded-2xl bg-white border border-[#d6d6d2] space-y-2 shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#c6a45c] shrink-0" />
                <span><strong className="text-[#202226]">Rotate:</strong> Left mouse button drag (or touch drag on mobile/tablet)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#c6a45c] shrink-0" />
                <span><strong className="text-[#202226]">Zoom:</strong> Scroll mouse wheel (or two-finger pinch on mobile)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#c6a45c] shrink-0" />
                <span><strong className="text-[#202226]">Pan:</strong> Right mouse button drag</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#c6a45c] shrink-0" />
                <span><strong className="text-[#202226]">Presets:</strong> Quick view buttons (Front, Top, White, Black, Cinematic, Free)</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
