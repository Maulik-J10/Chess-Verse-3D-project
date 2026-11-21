import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { soundManager } from '../audio/soundManager';
import { 
  AIDifficulty, 
  AI_DIFFICULTIES, 
  TIME_CONTROLS, 
  TimeControlPreset 
} from '../chess/types';
import { 
  Bot, 
  Users, 
  BookOpen, 
  Settings, 
  Play, 
  Sparkles, 
  Check, 
  ChevronRight,
  X
} from 'lucide-react';

interface MainMenuProps {
  onOpenSettings: () => void;
  onOpenHowToPlay: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onOpenSettings, onOpenHowToPlay }) => {
  const [showAiSetup, setShowAiSetup] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<AIDifficulty>('maximum');
  const [selectedColor, setSelectedColor] = useState<'w' | 'b' | 'random'>('w');
  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControlPreset>(TIME_CONTROLS[5]); // Rapid 10+0

  const startAiGame = useGameStore((s) => s.startAiGame);
  const setGameMode = useGameStore((s) => s.setGameMode);

  const handleStartAi = () => {
    soundManager.playClick();
    startAiGame(selectedColor, selectedDifficulty, selectedTimeControl);
  };

  const handleOpenMultiplayer = () => {
    soundManager.playClick();
    setGameMode('lobby');
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between p-4 sm:p-10 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] select-none overflow-y-auto">
      {/* Title & Royal Gallery Branding Header */}
      <div className="pointer-events-auto flex flex-col items-center sm:items-start max-w-md animate-fade-in mt-1 sm:mt-0">
        <div className="flex items-center gap-2 px-3 py-0.5 sm:px-3.5 sm:py-1 rounded-full bg-white/80 border border-[#c6a45c]/40 text-[#c6a45c] text-[10px] sm:text-xs font-serif font-bold tracking-widest uppercase mb-2 sm:mb-3 shadow-sm backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Royal 3D Chess Arena</span>
        </div>

        <h1 className="text-2xl sm:text-4xl md:text-5xl font-serif font-black tracking-wider text-[#202226] drop-shadow-sm text-center sm:text-left">
          Chess<span className="text-[#c6a45c]">Verse</span><span className="text-[#202226]">3D</span>
        </h1>

        <p className="text-[11px] sm:text-sm font-serif italic text-[#666762] mt-1 sm:mt-2 tracking-widest uppercase text-center sm:text-left">
          "Think beyond the board. See beyond the move."
        </p>
      </div>

      {/* Main Menu Buttons (Pearl-White & Champagne Gold Cards) */}
      <div className="pointer-events-auto flex flex-col gap-2.5 sm:gap-3 w-full max-w-xs sm:max-w-sm mx-auto sm:mx-0 animate-fade-in mb-2 sm:mb-4">
        {/* PLAY VS COMPUTER */}
        <button
          onClick={() => {
            soundManager.playClick();
            setShowAiSetup(true);
          }}
          className="group relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-[#f7f7f4]/95 backdrop-blur-md border border-[#c6a45c]/35 hover:border-[#c6a45c] hover:bg-white transition-all duration-300 shadow-royal-card active:scale-95 cursor-pointer min-h-[48px]"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-[#c6a45c]/15 border border-[#c6a45c]/30 text-[#c6a45c] group-hover:scale-110 transition-transform">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="text-left">
              <div className="font-serif font-bold text-xs sm:text-sm text-[#202226] group-hover:text-[#c6a45c] transition-colors tracking-wide">
                PLAY VS COMPUTER
              </div>
              <div className="text-[10px] sm:text-[11px] text-[#666762]">
                Stockfish 19 NNUE Grandmaster AI
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#a7a8a5] group-hover:text-[#c6a45c] group-hover:translate-x-1 transition-all" />
        </button>

        {/* PLAY WITH FRIEND */}
        <button
          onClick={handleOpenMultiplayer}
          className="group relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-[#f7f7f4]/95 backdrop-blur-md border border-[#c6a45c]/35 hover:border-[#c6a45c] hover:bg-white transition-all duration-300 shadow-royal-card active:scale-95 cursor-pointer min-h-[48px]"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-[#666762]/10 border border-[#666762]/25 text-[#202226] group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="text-left">
              <div className="font-serif font-bold text-xs sm:text-sm text-[#202226] group-hover:text-[#c6a45c] transition-colors tracking-wide">
                PLAY WITH FRIEND
              </div>
              <div className="text-[10px] sm:text-[11px] text-[#666762]">
                Real-time 1v1 Online Multiplayer
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#a7a8a5] group-hover:text-[#c6a45c] group-hover:translate-x-1 transition-all" />
        </button>

        {/* HOW TO PLAY & SETTINGS ROW */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              soundManager.playClick();
              onOpenHowToPlay();
            }}
            className="flex items-center justify-center gap-1.5 p-3 rounded-xl bg-[#f7f7f4]/95 backdrop-blur-md border border-[#c6a45c]/30 hover:border-[#c6a45c] hover:bg-white text-xs font-semibold text-[#202226] hover:text-[#c6a45c] transition-all cursor-pointer shadow-royal-card active:scale-95 min-h-[44px]"
          >
            <BookOpen className="w-4 h-4 text-[#c6a45c]" />
            <span>HOW TO PLAY</span>
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              onOpenSettings();
            }}
            className="flex items-center justify-center gap-1.5 p-3 rounded-xl bg-[#f7f7f4]/95 backdrop-blur-md border border-[#c6a45c]/30 hover:border-[#c6a45c] hover:bg-white text-xs font-semibold text-[#202226] hover:text-[#c6a45c] transition-all cursor-pointer shadow-royal-card active:scale-95 min-h-[44px]"
          >
            <Settings className="w-4 h-4 text-[#666762]" />
            <span>SETTINGS</span>
          </button>
        </div>
      </div>

      {/* ================= AI CONFIGURATION MODAL ================= */}
      {showAiSetup && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#f7f7f4] border border-[#c6a45c]/50 rounded-3xl p-5 sm:p-8 shadow-2xl text-[#202226] max-h-[90dvh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#c6a45c]/20 mb-4 sticky top-0 bg-[#f7f7f4] z-10">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-[#c6a45c]" />
                <h3 className="text-lg sm:text-xl font-serif font-bold text-[#202226]">VS COMPUTER SETUP</h3>
              </div>
              <button
                onClick={() => setShowAiSetup(false)}
                className="p-1.5 rounded-lg hover:bg-black/5 text-[#666762] hover:text-[#202226] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 text-xs">
              {/* Select Colour */}
              <div>
                <label className="block text-xs font-semibold text-[#666762] mb-2 uppercase tracking-wider">
                  Select Your Colour
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'w', label: 'Play as White', sub: 'You move first' },
                    { id: 'b', label: 'Play as Black', sub: 'Computer moves first' },
                    { id: 'random', label: 'Random Colour', sub: '50/50 chance' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedColor(c.id as any)}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        selectedColor === c.id
                          ? 'bg-[#c6a45c]/15 border-[#c6a45c] text-[#202226] shadow-sm font-bold'
                          : 'bg-white border-[#d6d6d2] text-[#666762] hover:border-[#c6a45c]/60'
                      }`}
                    >
                      <div className="font-serif font-bold text-sm text-[#202226]">{c.label}</div>
                      <div className="text-[10px] text-[#a7a8a5] mt-0.5">{c.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Select AI Difficulty */}
              <div>
                <label className="block text-xs font-semibold text-[#666762] mb-2 uppercase tracking-wider">
                  Select Opponent Strength
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {(Object.keys(AI_DIFFICULTIES) as AIDifficulty[]).map((diff) => {
                    const cfg = AI_DIFFICULTIES[diff];
                    const isSelected = selectedDifficulty === diff;
                    return (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setSelectedDifficulty(diff)}
                        className={`w-full p-2.5 rounded-xl text-left border flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#c6a45c]/15 border-[#c6a45c] text-[#202226] shadow-sm'
                            : 'bg-white border-[#d6d6d2] text-[#666762] hover:border-[#c6a45c]/60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-sm text-[#202226]">{cfg.label}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#c6a45c]/20 text-[#202226] font-semibold">
                              Elo {cfg.elo}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#666762] mt-0.5">{cfg.description}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#c6a45c] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Select Time Control */}
              <div>
                <label className="block text-xs font-semibold text-[#666762] mb-2 uppercase tracking-wider">
                  Select Time Control
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_CONTROLS.slice(2, 8).map((tc) => (
                    <button
                      key={tc.id}
                      type="button"
                      onClick={() => setSelectedTimeControl(tc)}
                      className={`p-2.5 rounded-xl text-center border transition-all cursor-pointer ${
                        selectedTimeControl.id === tc.id
                          ? 'bg-[#c6a45c]/15 border-[#c6a45c] text-[#202226] font-bold shadow-sm'
                          : 'bg-white border-[#d6d6d2] text-[#666762] hover:border-[#c6a45c]/60'
                      }`}
                    >
                      <div className="font-bold text-[#202226]">{tc.name}</div>
                      <div className="text-[10px] text-[#a7a8a5] capitalize">{tc.category}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartAi}
                className="w-full py-3.5 rounded-xl bg-[#c6a45c] hover:bg-[#b5934a] text-white font-serif font-bold text-sm tracking-widest uppercase transition-all shadow-glow-gold flex items-center justify-center gap-2 cursor-pointer mt-4 active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Begin Match</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
