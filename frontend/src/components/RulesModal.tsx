import React from 'react';
import { BookOpen, X, Shield, Sparkles, Scale } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#f7f7f4] border border-[#c6a45c]/40 rounded-3xl p-4 sm:p-8 shadow-2xl text-[#202226] max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#c6a45c]/20 mb-5 sticky top-0 bg-[#f7f7f4]/95 z-10">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#c6a45c]" />
            <h3 className="text-xl font-serif font-bold text-[#202226]">CHESS RULES</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Rules"
            className="p-1.5 rounded-lg hover:bg-black/5 text-[#666762] hover:text-[#202226] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 text-xs text-[#666762] leading-relaxed">
          {/* 1. Piece Movements */}
          <section>
            <h4 className="text-sm font-bold text-[#c6a45c] font-serif mb-3 flex items-center gap-1.5">
              <Shield className="w-4 h-4" />
              Piece Movements
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-sm text-[#202226] block mb-0.5">♙ Pawn</span>
                Moves forward 1 square onto an empty square (or 2 squares on its first move from its starting rank). Captures diagonally 1 square forward, and may capture enemy pawns via <strong>en passant</strong>.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-sm text-[#202226] block mb-0.5">♖ Rook</span>
                Moves any number of unobstructed squares horizontally (ranks) or vertically (files). Participates in castling with the King.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-sm text-[#202226] block mb-0.5">♘ Knight</span>
                Moves in an L-shape (2 squares orthogonally and 1 square perpendicular) and is the only piece able to leap over intervening pieces.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-sm text-[#202226] block mb-0.5">♗ Bishop</span>
                Moves any number of unobstructed squares diagonally, remaining on squares of its initial colour throughout the game.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-sm text-[#202226] block mb-0.5">♕ Queen</span>
                Moves any number of unobstructed squares horizontally, vertically, or diagonally, combining Rook and Bishop movement.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-sm text-[#202226] block mb-0.5">♔ King</span>
                Moves 1 square in any direction (horizontally, vertically, or diagonally), subject to legal-move restrictions: it can never move into check or adjacent to the opposing King.
              </div>
            </div>
          </section>

          {/* 2. Special Chess Rules */}
          <section>
            <h4 className="text-sm font-bold text-[#c6a45c] font-serif mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Special Chess Rules
            </h4>
            <div className="space-y-2.5">
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-[#202226]">Castling (Kingside O-O &amp; Queenside O-O-O):</span> The King moves 2 squares toward the target Rook, and that Rook leaps over to the square immediately beside the King. Permitted only when: neither the King nor that Rook has moved, all squares between them are empty, the King is not currently in check, and the King neither passes through nor finishes on any attacked square.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-[#202226]">En Passant:</span> When an opposing pawn advances 2 squares in a single move from its starting square and lands beside your pawn on its 5th rank (4th rank for Black), your pawn may capture it diagonally onto the skipped square. This capture is allowed only on the very next turn immediately following that two-square advance.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-[#202226]">Pawn Promotion:</span> Upon reaching the opposite back rank (8th rank for White, 1st rank for Black), a pawn must immediately promote to a Queen, Rook, Bishop, or Knight of the same colour regardless of pieces still on the board.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-[#202226]">Check:</span> A King is in check whenever an opponent&apos;s piece threatens to capture it on the next move. The checked player must immediately make a legal move that removes the threat (moving the King out of attack, blocking the line, or capturing the attacking piece).
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-[#202226]">Checkmate &amp; Stalemate:</span> When a King is in check and zero legal moves can escape the attack, it is <strong>Checkmate</strong> and the attacking side wins immediately. When the player to move is <strong>not</strong> in check yet has zero legal moves, the game ends immediately in a <strong>Stalemate</strong> draw.
              </div>
            </div>
          </section>

          {/* 3. Essential Match & Draw Rules */}
          <section>
            <h4 className="text-sm font-bold text-[#c6a45c] font-serif mb-3 flex items-center gap-1.5">
              <Scale className="w-4 h-4" />
              Essential Game &amp; Draw Rules
            </h4>
            <div className="space-y-2.5">
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-[#202226]">Turns, Captures &amp; Legality:</span> White always moves first and players alternate one move per turn. Pieces capture opponents by landing on their square and removing them from the board (Kings cannot be captured directly). Any move that exposes or leaves your own King in check is illegal and prevented automatically.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-[#202226]">Threefold Repetition:</span> If the exact same position occurs three times during a match (with the same player to move, castling rights, and en passant availability), the game ends in a draw under engine rules.
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm">
                <span className="font-serif font-bold text-[#202226]">Fifty-Move Rule &amp; Insufficient Material:</span> The game is drawn if 50 consecutive full moves pass with neither a pawn move nor a capture, or if neither side retains sufficient material to force checkmate (e.g., King vs King, King + Bishop vs King, King + Knight vs King, or King + Bishop vs King + Bishop on matching square colours).
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
