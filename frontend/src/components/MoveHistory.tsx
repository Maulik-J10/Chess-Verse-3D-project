import React, { useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { History, ChevronLeft, ChevronRight, Play } from 'lucide-react';

export const MoveHistory: React.FC = () => {
  const history = useGameStore((s) => s.history);
  const historyIndex = useGameStore((s) => s.historyIndex);
  const setHistoryIndex = useGameStore((s) => s.setHistoryIndex);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Group moves into pairs (White move, Black move)
  const movePairs: { num: number; white?: { san: string; idx: number }; black?: { san: string; idx: number } }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push({
      num: Math.floor(i / 2) + 1,
      white: { san: history[i].san, idx: i },
      black: history[i + 1] ? { san: history[i + 1].san, idx: i + 1 } : undefined,
    });
  }

  // Auto-scroll to latest move if viewing live
  useEffect(() => {
    if (historyIndex === -1 && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history.length, historyIndex]);

  const isLive = historyIndex === -1 || historyIndex === history.length - 1;

  return (
    <div className="flex flex-col bg-[#f7f7f4]/95 backdrop-blur-md border border-[#c6a45c]/35 rounded-2xl overflow-hidden shadow-royal-card w-full text-xs text-[#202226]">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#c6a45c]/20 bg-[#eeede8]/60">
        <div className="flex items-center gap-1.5 font-serif font-bold text-[#202226]">
          <History className="w-3.5 h-3.5 text-[#c6a45c]" />
          <span>Move History</span>
          <span className="text-[10px] text-[#a7a8a5] font-sans">({history.length} ply)</span>
        </div>

        {/* Live Status indicator */}
        <button
          onClick={() => setHistoryIndex(-1)}
          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
            isLive
              ? 'bg-[#c6a45c]/20 text-[#202226] border border-[#c6a45c]/40 font-bold'
              : 'bg-amber-100 text-amber-800 border border-amber-400 animate-pulse hover:bg-amber-200 cursor-pointer'
          }`}
        >
          <Play className="w-2.5 h-2.5 fill-current text-[#c6a45c]" />
          {isLive ? 'LIVE' : 'JUMP TO LIVE'}
        </button>
      </div>

      {/* Review Banner if browsing past moves */}
      {!isLive && (
        <div className="bg-[#c6a45c]/10 border-b border-[#c6a45c]/30 px-3 py-1 text-center text-[11px] font-serif text-[#202226]">
          Review Mode (Move #{Math.floor(historyIndex / 2) + 1} {historyIndex % 2 === 0 ? 'White' : 'Black'}). Board is read-only.
        </div>
      )}

      {/* Move list */}
      <div
        ref={scrollRef}
        className="max-h-48 overflow-y-auto p-2 space-y-0.5 font-mono select-none"
      >
        {movePairs.length === 0 ? (
          <div className="text-[#a7a8a5] italic text-center py-4 text-[11px]">
            No moves played yet.
          </div>
        ) : (
          movePairs.map((pair) => (
            <div key={pair.num} className="flex items-center rounded hover:bg-black/5 text-[11px]">
              <span className="w-8 text-[#a7a8a5] text-right pr-2 py-0.5 font-sans font-medium">
                {pair.num}.
              </span>

              {/* White Move */}
              {pair.white && (
                <button
                  onClick={() => setHistoryIndex(pair.white!.idx)}
                  className={`flex-1 text-left px-2 py-0.5 rounded transition-colors font-medium ${
                    historyIndex === pair.white.idx
                      ? 'bg-[#c6a45c]/25 text-[#202226] font-bold border border-[#c6a45c]'
                      : 'text-[#202226] hover:bg-black/5'
                  }`}
                >
                  {pair.white.san}
                </button>
              )}

              {/* Black Move */}
              {pair.black ? (
                <button
                  onClick={() => setHistoryIndex(pair.black!.idx)}
                  className={`flex-1 text-left px-2 py-0.5 rounded transition-colors font-medium ${
                    historyIndex === pair.black.idx
                      ? 'bg-[#c6a45c]/25 text-[#202226] font-bold border border-[#c6a45c]'
                      : 'text-[#666762] hover:text-[#202226] hover:bg-black/5'
                  }`}
                >
                  {pair.black.san}
                </button>
              ) : (
                <div className="flex-1" />
              )}
            </div>
          ))
        )}
      </div>

      {/* History Navigation Buttons */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#eeede8]/60 border-t border-[#c6a45c]/20 text-[#666762]">
        <button
          onClick={() => {
            const cur = historyIndex === -1 ? history.length - 1 : historyIndex;
            if (cur > 0) setHistoryIndex(cur - 1);
          }}
          disabled={history.length === 0 || historyIndex === 0}
          className="p-1 rounded hover:bg-black/5 hover:text-[#202226] disabled:opacity-30 disabled:cursor-not-allowed"
          title="Previous Move"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-[10px] text-[#a7a8a5] font-sans font-medium">
          {historyIndex === -1 ? 'Current' : `${historyIndex + 1} / ${history.length}`}
        </span>

        <button
          onClick={() => {
            if (historyIndex !== -1 && historyIndex < history.length - 1) {
              setHistoryIndex(historyIndex + 1);
            } else {
              setHistoryIndex(-1);
            }
          }}
          disabled={history.length === 0 || historyIndex === -1}
          className="p-1 rounded hover:bg-black/5 hover:text-[#202226] disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next Move"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
