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
  Camera 
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

  if (!isOpen) return null;

  const qualities: { id: GraphicsQuality; label: string; desc: string }[] = [
    { id: 'low', label: 'Low', desc: 'Performance optimized for mobile/older devices' },
    { id: 'medium', label: 'Medium', desc: 'Balanced lighting and performance' },
    { id: 'high', label: 'High', desc: 'Realistic shadows & ambient reflections' },
    { id: 'ultra', label: 'Ultra', desc: 'Full fidelity ACES tone mapping & maximum resolution' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-[#f7f7f4] border border-[#c6a45c]/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-[#202226]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#c6a45c]/20 mb-5">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#c6a45c]" />
            <h3 className="text-lg font-serif font-bold text-[#202226]">SETTINGS</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/5 text-[#666762] hover:text-[#202226] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 text-xs">
          {/* Graphics Quality */}
          <div>
            <div className="flex items-center gap-1.5 font-serif font-bold text-[#202226] mb-2">
              <Monitor className="w-4 h-4 text-[#c6a45c]" />
              <span>3D Graphics Quality</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {qualities.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setGraphicsQuality(q.id)}
                  className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                    graphicsQuality === q.id
                      ? 'bg-[#c6a45c]/15 border-[#c6a45c] text-[#202226] shadow-sm font-bold'
                      : 'bg-white border-[#d6d6d2] text-[#666762] hover:border-[#c6a45c]/60'
                  }`}
                >
                  <div className="font-serif font-bold text-sm text-[#202226]">{q.label}</div>
                  <div className="text-[10px] text-[#a7a8a5] mt-0.5 line-clamp-1">{q.desc}</div>
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
                <div className="text-[10px] text-[#a7a8a5]">Procedural pieces and atmosphere audio</div>
              </div>
            </div>
            <button
              onClick={() => {
                toggleSound();
                soundManager.playClick();
              }}
              className={`px-3 py-1.5 rounded-xl font-serif font-bold text-xs transition-colors cursor-pointer ${
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
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#d6d6d2]">
              <div className="flex items-center gap-2.5">
                <Eye className="w-4 h-4 text-[#c6a45c]" />
                <div>
                  <div className="font-serif font-bold text-sm text-[#202226]">Legal Move Highlights</div>
                  <div className="text-[10px] text-[#a7a8a5]">Highlight valid destination squares</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={showLegalMoves}
                onChange={toggleLegalMoves}
                className="w-4 h-4 accent-[#c6a45c] cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#d6d6d2]">
              <div className="flex items-center gap-2.5">
                <Lightbulb className="w-4 h-4 text-[#c6a45c]" />
                <div>
                  <div className="font-serif font-bold text-sm text-[#202226]">Move Hints & Indicators</div>
                  <div className="text-[10px] text-[#a7a8a5]">Show king in check glow & last moves</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={showHints}
                onChange={toggleHints}
                className="w-4 h-4 accent-[#c6a45c] cursor-pointer"
              />
            </div>
          </div>

          {/* Reset Camera Button */}
          <button
            onClick={() => {
              setCameraPreset('front');
              soundManager.playClick();
            }}
            className="w-full py-2.5 rounded-xl bg-white hover:bg-gray-100 border border-[#d6d6d2] text-[#202226] font-serif font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <Camera className="w-3.5 h-3.5 text-[#c6a45c]" />
            <span>Reset Camera to Default Front View</span>
          </button>
        </div>
      </div>
    </div>
  );
};
