import React from 'react';
import { useGameStore } from '../store/gameStore';
import { GraphicsQuality } from '../chess/types';
import { soundManager } from '../audio/soundManager';
import { 
  Settings, 
  Volume2, 
  VolumeX, 
  Monitor, 
  Eye, 
  Lightbulb, 
  X, 
  Camera,
  Activity
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const setGraphicsQuality = useGameStore((s) => s.setGraphicsQuality);
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const showLegalMoves = useGameStore((s) => s.showLegalMoves);
  const toggleLegalMoves = useGameStore((s) => s.toggleLegalMoves);
  const showHints = useGameStore((s) => s.showHints);
  const toggleHints = useGameStore((s) => s.toggleHints);
  const setCameraPreset = useGameStore((s) => s.setCameraPreset);
  const showPerfOverlay = useGameStore((s) => s.showPerfOverlay);
  const togglePerfOverlay = useGameStore((s) => s.togglePerfOverlay);

  if (!isOpen) return null;

  const qualities: { id: GraphicsQuality; label: string; badge: string; desc: string }[] = [
    { id: 'low', label: 'Performance', badge: 'Low-End Mobile', desc: '1x DPR, fast shaders & demand loop for weaker phones' },
    { id: 'medium', label: 'Balanced', badge: 'Avg Devices', desc: 'Adaptive resolution, 512px shadows & zero idle GPU drain' },
    { id: 'high', label: 'High Quality', badge: 'Capable Devices', desc: 'Crisp resolution, soft piece wood bump & dynamic lighting' },
    { id: 'ultra', label: 'Ultra Cinema', badge: 'Max Fidelity', desc: 'Full spotlight accents, 2K shadows & up to 2x native DPR' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-[#f7f7f4] border border-[#c6a45c]/40 rounded-3xl p-5 sm:p-7 shadow-2xl text-[#202226] max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#c6a45c]/20 mb-4 sticky top-0 bg-[#f7f7f4] z-10">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#c6a45c]" />
            <h3 className="text-lg font-serif font-bold text-[#202226]">SETTINGS</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 text-[#666762] hover:text-[#202226] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Graphics Quality */}
          <div>
            <div className="flex items-center gap-1.5 font-serif font-bold text-[#202226] mb-2">
              <Monitor className="w-4 h-4 text-[#c6a45c]" />
              <span>3D Graphics & Performance Profile</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {qualities.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setGraphicsQuality(q.id)}
                  className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                    graphicsQuality === q.id
                      ? 'bg-[#c6a45c]/15 border-[#c6a45c] text-[#202226] shadow-sm font-bold ring-1 ring-[#c6a45c]'
                      : 'bg-white border-[#d6d6d2] text-[#666762] hover:border-[#c6a45c]/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif font-bold text-xs text-[#202226]">{q.label}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/5 text-[#666762] font-mono">
                      {q.badge}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#a7a8a5] mt-1 leading-snug">{q.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sound & Audio */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#d6d6d2]">
            <div className="flex items-center gap-2.5">
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[#c6a45c]" />
              ) : (
                <VolumeX className="w-4 h-4 text-[#a7a8a5]" />
              )}
              <div>
                <div className="font-serif font-bold text-sm text-[#202226]">Sound Effects</div>
                <div className="text-[10px] text-[#a7a8a5]">Procedural piece movement & captures</div>
              </div>
            </div>
            <button
              onClick={() => {
                toggleSound();
                soundManager.playClick();
              }}
              className={`px-3 py-2 rounded-xl font-serif font-bold text-xs transition-colors cursor-pointer min-w-[75px] ${
                soundEnabled
                  ? 'bg-[#c6a45c] text-white shadow-sm'
                  : 'bg-gray-100 text-[#666762] border border-[#d6d6d2]'
              }`}
            >
              {soundEnabled ? 'ENABLED' : 'MUTED'}
            </button>
          </div>

          {/* Gameplay Assistance */}
          <div className="space-y-2">
            <label className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#d6d6d2] cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Eye className="w-4 h-4 text-[#c6a45c]" />
                <div>
                  <div className="font-serif font-bold text-sm text-[#202226]">Legal Move Highlights</div>
                  <div className="text-[10px] text-[#a7a8a5]">Highlight valid destination squares on tap</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={showLegalMoves}
                onChange={toggleLegalMoves}
                className="w-5 h-5 accent-[#c6a45c] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#d6d6d2] cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Lightbulb className="w-4 h-4 text-[#c6a45c]" />
                <div>
                  <div className="font-serif font-bold text-sm text-[#202226]">Move Hints & Checks</div>
                  <div className="text-[10px] text-[#a7a8a5]">Show king in check glow & last moves</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={showHints}
                onChange={toggleHints}
                className="w-5 h-5 accent-[#c6a45c] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#d6d6d2] cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-[#c6a45c]" />
                <div>
                  <div className="font-serif font-bold text-sm text-[#202226]">Performance Stats Overlay</div>
                  <div className="text-[10px] text-[#a7a8a5]">Live FPS, frame time ms, and DPR monitor</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={showPerfOverlay}
                onChange={togglePerfOverlay}
                className="w-5 h-5 accent-[#c6a45c] cursor-pointer"
              />
            </label>
          </div>

          {/* Reset Camera Button */}
          <button
            onClick={() => {
              setCameraPreset('front');
              soundManager.playClick();
              onClose();
            }}
            className="w-full py-3 rounded-xl bg-white active:bg-gray-100 border border-[#d6d6d2] text-[#202226] font-serif font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm min-h-[44px]"
          >
            <Camera className="w-3.5 h-3.5 text-[#c6a45c]" />
            <span>Reset Camera to Front View</span>
          </button>
        </div>
      </div>
    </div>
  );
};
