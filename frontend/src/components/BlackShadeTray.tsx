import React from 'react';
import { Check, Palette, X } from 'lucide-react';
import { BLACK_PIECE_SHADES, getBlackPieceShadeOption } from '../chess/types';
import { useGameStore } from '../store/gameStore';
import { soundManager } from '../audio/soundManager';

interface BlackShadeTrayProps {
  variant?: 'settings' | 'popover';
  onClose?: () => void;
}

export const BlackShadeTray: React.FC<BlackShadeTrayProps> = ({
  variant = 'settings',
  onClose,
}) => {
  const blackPieceShade = useGameStore((s) => s.blackPieceShade);
  const setBlackPieceShade = useGameStore((s) => s.setBlackPieceShade);
  const activeOption = getBlackPieceShadeOption(blackPieceShade);

  const isPopover = variant === 'popover';

  return (
    <div
      className={
        isPopover
          ? 'pointer-events-auto w-[274px] sm:w-[308px] bg-[#f7f7f4]/95 lg:backdrop-blur-md border border-[#c6a45c]/50 rounded-2xl p-3 sm:p-3.5 shadow-2xl text-[#202226] animate-fade-in'
          : 'space-y-2'
      }
      data-testid="black-shade-color-tray"
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <div className="flex items-center gap-1.5 font-serif font-bold text-[#202226] text-xs whitespace-nowrap">
          <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#c6a45c] shrink-0" />
          <span>Black Shade</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#c6a45c]/15 border border-[#c6a45c]/30 text-[#7d622b] font-mono font-semibold whitespace-nowrap">
            Lighter Shades
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-black/5 text-[#666762] hover:text-[#202226] cursor-pointer"
              title="Close Color Tray"
              aria-label="Close Color Tray"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Swatch Tray */}
      <div className="p-2.5 sm:p-3 rounded-2xl bg-white border border-[#d6d6d2] shadow-sm space-y-2">
        <div className="grid grid-cols-6 gap-1.5 sm:gap-2 items-center justify-items-center" role="radiogroup" aria-label="Black Piece Shades">
          {BLACK_PIECE_SHADES.map((shade) => {
            const isSelected = shade.id === blackPieceShade;
            return (
              <button
                key={shade.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${shade.label} shade`}
                title={`${shade.label} (${shade.hex})`}
                onClick={() => {
                  setBlackPieceShade(shade.id);
                  soundManager.playClick();
                }}
                className={`group relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full transition-all cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'ring-2 ring-[#c6a45c] ring-offset-2 ring-offset-white scale-105 shadow-md'
                    : 'border border-black/15 hover:scale-105 hover:ring-2 hover:ring-[#c6a45c]/40'
                }`}
                style={{
                  background: `radial-gradient(circle at 32% 28%, ${shade.highlightHex} 0%, ${shade.hex} 72%, #202226 100%)`,
                }}
              >
                {isSelected && <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white drop-shadow" strokeWidth={2.75} />}
              </button>
            );
          })}
        </div>

        {/* Active Shade Readout & Ivory Contrast Preview */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#ecece8] text-[11px]">
          <div className="min-w-0">
            <div className="font-serif font-bold text-[#202226] truncate" data-testid="active-black-shade-label">
              {activeOption.label}
            </div>
            <div className="text-[10px] text-[#666762] truncate">{activeOption.desc}</div>
          </div>

          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#f7f7f4] border border-[#d6d6d2] shrink-0"
            title="Black vs Ivory White contrast preview"
          >
            <span
              className="w-3 h-3 rounded-full border border-black/20"
              style={{ backgroundColor: activeOption.hex }}
            />
            <span className="text-[9px] text-[#a7a8a5] font-mono">vs</span>
            <span className="w-3 h-3 rounded-full bg-[#f0e2cc] border border-black/15" />
          </div>
        </div>
      </div>
    </div>
  );
};
