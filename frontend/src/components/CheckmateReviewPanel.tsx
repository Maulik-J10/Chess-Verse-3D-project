import React from 'react';
import { useGameStore } from '../store/gameStore';
import { AlertTriangle, CheckCircle2, ArrowLeft, ChevronLeft, ChevronRight, Target } from 'lucide-react';

interface CheckmateReviewPanelProps {
  compact?: boolean;
}

export const CheckmateReviewPanel: React.FC<CheckmateReviewPanelProps> = ({ compact = false }) => {
  const reviewSummary = useGameStore((s) => s.reviewSummary);
  const history = useGameStore((s) => s.history);
  const historyIndex = useGameStore((s) => s.historyIndex);
  const setHistoryIndex = useGameStore((s) => s.setHistoryIndex);
  const exitReviewMode = useGameStore((s) => s.exitReviewMode);

  if (!reviewSummary && history.length === 0) return null;

  const currentIdx = historyIndex === -1 ? history.length - 1 : historyIndex;

  return (
    <div
      className={`bg-[#f7f7f4]/[0.97] border border-[#c6a45c]/50 rounded-2xl shadow-royal-card text-[#202226] ${
        compact ? 'p-3 text-[11px]' : 'p-3.5 text-xs'
      }`}
    >
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#c6a45c]/25">
        <div className="flex items-center gap-1.5 min-w-0">
          <Target className="w-3.5 h-3.5 text-[#c6a45c] shrink-0" />
          <span className="font-serif font-bold uppercase tracking-wider text-[11px] truncate">
            {reviewSummary ? reviewSummary.motif : 'Post-Game Board Review'}
          </span>
        </div>
        <button
          type="button"
          onClick={exitReviewMode}
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white hover:bg-[#c6a45c]/15 border border-[#c6a45c]/40 text-[10px] font-serif font-bold text-[#202226] cursor-pointer shrink-0"
          title="Return to Match Summary"
        >
          <ArrowLeft className="w-3 h-3 text-[#c6a45c]" />
          <span>Results</span>
        </button>
      </div>

      {reviewSummary ? (
        <div className="space-y-2">
          <div className="p-2 rounded-xl bg-white border border-[#d6d6d2] leading-relaxed text-[#202226]">
            <p className="font-medium">{reviewSummary.summary}</p>
            <p className="text-[#666762] mt-1">{reviewSummary.kingEscapeNote}</p>
          </div>

          {reviewSummary.decisiveMistakeIndex !== null && reviewSummary.decisiveMistakeReason ? (
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-950">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider text-amber-800">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  Decisive Mistake: {reviewSummary.decisiveMistakeSan}
                </span>
                {reviewSummary.betterMoveSan && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                    Best: {reviewSummary.betterMoveSan}
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-snug">{reviewSummary.decisiveMistakeReason}</p>
            </div>
          ) : (
            <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span className="text-[11px] leading-snug">
                No single immediate last-move escape was available once the mating net closed.
              </span>
            </div>
          )}

          {/* Quick Jump Actions */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {reviewSummary.decisiveMistakeIndex !== null && (
              <button
                type="button"
                onClick={() => setHistoryIndex(reviewSummary.decisiveMistakeIndex!)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-serif font-bold border transition-all cursor-pointer ${
                  currentIdx === reviewSummary.decisiveMistakeIndex
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white hover:bg-amber-50 text-amber-900 border-amber-300'
                }`}
              >
                Mistake ({reviewSummary.decisiveMistakeSan})
              </button>
            )}
            <button
              type="button"
              onClick={() => setHistoryIndex(reviewSummary.matingMoveIndex)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-serif font-bold border transition-all cursor-pointer ${
                currentIdx === reviewSummary.matingMoveIndex
                  ? 'bg-[#c6a45c] text-white border-[#c6a45c]'
                  : 'bg-white hover:bg-[#c6a45c]/10 text-[#202226] border-[#c6a45c]/40'
              }`}
            >
              Checkmate ({reviewSummary.matingSan})
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => currentIdx > 0 && setHistoryIndex(currentIdx - 1)}
            disabled={currentIdx <= 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#d6d6d2] disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>
          <span className="font-mono text-[11px] text-[#666762]">
            Ply {currentIdx + 1} / {history.length}
          </span>
          <button
            type="button"
            onClick={() =>
              currentIdx < history.length - 1 ? setHistoryIndex(currentIdx + 1) : setHistoryIndex(-1)
            }
            disabled={currentIdx >= history.length - 1}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#d6d6d2] disabled:opacity-40 cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
