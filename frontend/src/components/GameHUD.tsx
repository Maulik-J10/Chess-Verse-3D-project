import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { GameClock } from './GameClock';
import { CapturedPieces } from './CapturedPieces';
import { ThinkingIndicator } from './ThinkingIndicator';
import { MoveHistory } from './MoveHistory';
import { 
  RotateCcw, 
  Flag, 
  Handshake, 
  Undo2, 
  Volume2, 
  VolumeX, 
  Compass, 
  Home, 
  RefreshCw, 
  Users, 
  Bot, 
  Copy, 
  Check,
  Camera
} from 'lucide-react';
import { CameraPreset } from '../chess/types';

interface GameHUDProps {
  onOpenSettings: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({ onOpenSettings }) => {
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Store selections
  const gameMode = useGameStore((s) => s.gameMode);
  const turn = useGameStore((s) => s.turn);
  const playerColor = useGameStore((s) => s.playerColor);
  const opponentName = useGameStore((s) => s.opponentName);
  const whiteTimeMs = useGameStore((s) => s.whiteTimeMs);
  const blackTimeMs = useGameStore((s) => s.blackTimeMs);
  const isThinking = useGameStore((s) => s.isThinking);
  const difficulty = useGameStore((s) => s.difficulty);
  const capturedWhite = useGameStore((s) => s.capturedWhite);
  const capturedBlack = useGameStore((s) => s.capturedBlack);
  const materialAdvantage = useGameStore((s) => s.materialAdvantage);
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const cameraPreset = useGameStore((s) => s.cameraPreset);
  const multiplayer = useGameStore((s) => s.multiplayer);

  // Actions
  const resign = useGameStore((s) => s.resign);
  const resetGame = useGameStore((s) => s.resetGame);
  const undoMove = useGameStore((s) => s.undoMove);
  const offerDraw = useGameStore((s) => s.offerDraw);
  const acceptDraw = useGameStore((s) => s.acceptDraw);
  const rejectDraw = useGameStore((s) => s.rejectDraw);
  const flipBoard = useGameStore((s) => s.flipBoard);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const setCameraPreset = useGameStore((s) => s.setCameraPreset);
  const returnToMenu = useGameStore((s) => s.returnToMenu);

  const isMyTurn = turn === playerColor;

  const handleCopyRoomCode = () => {
    if (multiplayer.roomCode) {
      navigator.clipboard.writeText(multiplayer.roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const cameraButtons: { preset: CameraPreset; label: string }[] = [
    { preset: 'front', label: 'Front' },
    { preset: 'white', label: 'White' },
    { preset: 'black', label: 'Black' },
    { preset: 'top', label: 'Top' },
    { preset: 'cinematic', label: 'Cinematic' },
    { preset: 'free', label: '360° Free' },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-5 select-none z-20">
      {/* ================= TOP BAR ================= */}
      <header className="pointer-events-auto flex items-center justify-between gap-3 w-full max-w-6xl mx-auto">
        {/* Game Mode & Title Badge */}
        <div className="flex items-center gap-3 bg-[#f7f7f4]/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-[#c6a45c]/35 shadow-royal-card">
          <button
            onClick={returnToMenu}
            className="flex items-center gap-1.5 text-xs text-[#666762] hover:text-[#202226] transition-colors cursor-pointer"
            title="Return to Main Menu"
          >
            <Home className="w-4 h-4 text-[#c6a45c]" />
            <span className="hidden sm:inline font-serif font-bold text-[#202226]">CHESSVERSE3D</span>
          </button>

          <span className="w-px h-4 bg-[#d6d6d2]" />

          <div className="flex items-center gap-1.5 text-xs">
            {gameMode === 'ai' ? (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#c6a45c]/15 text-[#202226] border border-[#c6a45c]/35 font-serif font-semibold text-[11px]">
                <Bot className="w-3 h-3 text-[#c6a45c]" />
                VS AI ({difficulty.toUpperCase()})
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#666762]/10 text-[#202226] border border-[#666762]/30 font-serif font-semibold text-[11px]">
                <Users className="w-3 h-3 text-[#202226]" />
                MULTIPLAYER
              </span>
            )}

            {/* Room code pill */}
            {multiplayer.roomCode && (
              <button
                onClick={handleCopyRoomCode}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white hover:bg-[#c6a45c]/10 text-[#202226] border border-[#c6a45c]/40 font-mono text-[11px] cursor-pointer"
                title="Click to copy room code"
              >
                <span>Code: {multiplayer.roomCode}</span>
                {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-[#c6a45c]" />}
              </button>
            )}
          </div>
        </div>

        {/* Turn & Thinking Banner in Center */}
        <div className="flex items-center gap-2">
          {isThinking ? (
            <ThinkingIndicator difficulty={difficulty} />
          ) : (
            <div
              className={`px-3.5 py-1.5 rounded-full text-xs font-serif font-bold backdrop-blur-md border shadow-royal-card flex items-center gap-2 ${
                isMyTurn
                  ? 'bg-[#c6a45c]/20 border-[#c6a45c] text-[#202226] shadow-glow-gold'
                  : 'bg-[#f7f7f4]/95 border-[#d6d6d2] text-[#666762]'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  turn === 'w' ? 'bg-[#f7f7f4] border border-[#bfc1c2]' : 'bg-[#202226]'
                }`}
              />
              <span>{isMyTurn ? 'Your Turn to Move' : "Opponent's Turn"}</span>
            </div>
          )}
        </div>

        {/* Quick Settings & Audio */}
        <div className="flex items-center gap-2 bg-[#f7f7f4]/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-[#c6a45c]/35 shadow-royal-card">
          <button
            onClick={toggleSound}
            className="p-1.5 rounded-lg text-[#666762] hover:text-[#202226] hover:bg-black/5 transition-colors cursor-pointer"
            title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#c6a45c]" /> : <VolumeX className="w-4 h-4 text-[#a7a8a5]" />}
          </button>

          <button
            onClick={flipBoard}
            className="p-1.5 rounded-lg text-[#666762] hover:text-[#202226] hover:bg-black/5 transition-colors cursor-pointer"
            title="Flip Board"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg text-[#666762] hover:text-[#202226] hover:bg-black/5 transition-colors cursor-pointer"
            title="Settings & Graphics"
          >
            <Compass className="w-4 h-4 text-[#c6a45c]" />
          </button>
        </div>
      </header>

      {/* ================= MIDDLE WORKSPACE (PLAYERS & PANELS) ================= */}
      <div className="pointer-events-none flex items-start justify-between w-full max-w-6xl mx-auto my-auto gap-4">
        {/* Left Player Cards / Clocks */}
        <div className="pointer-events-auto flex flex-col gap-3 w-56 sm:w-64">
          {/* Opponent Card (Top) */}
          <div className="bg-[#f7f7f4]/95 backdrop-blur-md border border-[#c6a45c]/35 rounded-2xl p-3 shadow-royal-card">
            <GameClock
              color={playerColor === 'w' ? 'b' : 'w'}
              timeMs={playerColor === 'w' ? blackTimeMs : whiteTimeMs}
              isActive={turn !== playerColor}
              playerName={opponentName}
            />
            <div className="mt-2">
              <CapturedPieces
                captured={playerColor === 'w' ? capturedBlack : capturedWhite}
                advantage={playerColor === 'w' ? (materialAdvantage < 0 ? Math.abs(materialAdvantage) : 0) : (materialAdvantage > 0 ? materialAdvantage : 0)}
              />
            </div>
          </div>

          {/* User Player Card (Bottom) */}
          <div className="bg-[#f7f7f4]/95 backdrop-blur-md border border-[#c6a45c]/35 rounded-2xl p-3 shadow-royal-card">
            <GameClock
              color={playerColor}
              timeMs={playerColor === 'w' ? whiteTimeMs : blackTimeMs}
              isActive={turn === playerColor}
              playerName="You"
            />
            <div className="mt-2">
              <CapturedPieces
                captured={playerColor === 'w' ? capturedWhite : capturedBlack}
                advantage={playerColor === 'w' ? (materialAdvantage > 0 ? materialAdvantage : 0) : (materialAdvantage < 0 ? Math.abs(materialAdvantage) : 0)}
              />
            </div>
          </div>

          {/* Multiplayer Opponent Disconnect Notice */}
          {multiplayer.opponentDisconnected && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-2.5 text-xs text-red-800 animate-pulse text-center font-semibold">
              Opponent disconnected! Waiting {multiplayer.gracePeriod || 60}s for reconnection...
            </div>
          )}

          {/* Multiplayer Draw Offer Alert */}
          {multiplayer.drawOffered && (
            <div className="bg-[#f7f7f4] border-2 border-[#c6a45c] rounded-2xl p-3.5 text-xs text-[#202226] shadow-xl">
              <p className="font-serif font-bold mb-2 text-[#202226]">Opponent has offered a draw.</p>
              <div className="flex gap-2">
                <button
                  onClick={acceptDraw}
                  className="flex-1 py-1.5 bg-[#c6a45c] hover:bg-[#b5934a] rounded-lg text-white font-bold cursor-pointer transition-colors"
                >
                  Accept
                </button>
                <button
                  onClick={rejectDraw}
                  className="flex-1 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-lg text-[#202226] font-semibold cursor-pointer transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Move History & Camera Presets */}
        <div className="pointer-events-auto hidden md:flex flex-col gap-3 w-64">
          <MoveHistory />

          {/* Camera View Presets */}
          <div className="bg-[#f7f7f4]/95 backdrop-blur-md border border-[#c6a45c]/35 rounded-2xl p-2.5 shadow-royal-card text-[#202226]">
            <div className="flex items-center gap-1.5 text-xs text-[#666762] font-serif font-bold mb-2 px-1">
              <Camera className="w-3.5 h-3.5 text-[#c6a45c]" />
              <span>Camera Views</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {cameraButtons.map((btn) => (
                <button
                  key={btn.preset}
                  onClick={() => setCameraPreset(btn.preset)}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    cameraPreset === btn.preset
                      ? 'bg-[#c6a45c] text-white font-bold shadow-sm'
                      : 'bg-white hover:bg-[#c6a45c]/10 text-[#202226] border border-[#d6d6d2]'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ================= BOTTOM ACTION BAR ================= */}
      <footer className="pointer-events-auto flex items-center justify-between w-full max-w-6xl mx-auto gap-2 bg-[#f7f7f4]/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-[#c6a45c]/35 shadow-royal-card text-xs">
        {/* Left Side Game Actions */}
        <div className="flex items-center gap-2">
          {/* Undo Button (AI Mode Only) */}
          {gameMode === 'ai' && (
            <button
              onClick={undoMove}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-[#c6a45c]/10 border border-[#d6d6d2] text-[#202226] font-medium transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Undo Move (Takeback)"
            >
              <Undo2 className="w-3.5 h-3.5 text-[#c6a45c]" />
              <span className="hidden sm:inline">Undo Move</span>
            </button>
          )}

          {/* Draw Offer Button */}
          <button
            onClick={offerDraw}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-[#c6a45c]/10 border border-[#d6d6d2] text-[#202226] font-medium transition-all cursor-pointer active:scale-95 shadow-sm"
            title="Offer Draw"
          >
            <Handshake className="w-3.5 h-3.5 text-[#c6a45c]" />
            <span className="hidden sm:inline">Offer Draw</span>
          </button>

          {/* Resign Button */}
          <button
            onClick={() => setShowResignConfirm(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-medium transition-all cursor-pointer active:scale-95 shadow-sm"
            title="Resign Game"
          >
            <Flag className="w-3.5 h-3.5 text-red-500" />
            <span className="hidden sm:inline">Resign</span>
          </button>
        </div>

        {/* Right Side Options */}
        <div className="flex items-center gap-2">
          {/* New Game */}
          <button
            onClick={() => setShowNewGameConfirm(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#c6a45c] hover:bg-[#b5934a] text-white font-serif font-bold transition-all cursor-pointer active:scale-95 shadow-glow-gold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>New Game</span>
          </button>
        </div>
      </footer>

      {/* ================= RESIGN CONFIRMATION MODAL ================= */}
      {showResignConfirm && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#f7f7f4] border border-[#c6a45c]/40 rounded-3xl p-6 shadow-2xl text-center text-[#202226]">
            <Flag className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h3 className="text-base font-serif font-bold text-[#202226] mb-1">Resign Game?</h3>
            <p className="text-xs text-[#666762] mb-5">
              Are you sure you want to surrender this match to your opponent?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResignConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-white hover:bg-gray-100 text-[#202226] border border-[#d6d6d2] text-xs font-semibold cursor-pointer"
              >
                Continue Playing
              </button>
              <button
                onClick={() => {
                  setShowResignConfirm(false);
                  resign();
                }}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
              >
                Yes, Resign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= NEW GAME CONFIRMATION MODAL ================= */}
      {showNewGameConfirm && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#f7f7f4] border border-[#c6a45c]/40 rounded-3xl p-6 shadow-2xl text-center text-[#202226]">
            <RefreshCw className="w-10 h-10 text-[#c6a45c] mx-auto mb-3" />
            <h3 className="text-base font-serif font-bold text-[#202226] mb-1">Start New Match?</h3>
            <p className="text-xs text-[#666762] mb-5">
              Reset the current game board and commence a fresh match?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewGameConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-white hover:bg-gray-100 text-[#202226] border border-[#d6d6d2] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowNewGameConfirm(false);
                  resetGame();
                }}
                className="flex-1 py-2 rounded-xl bg-[#c6a45c] hover:bg-[#b5934a] text-white text-xs font-serif font-bold cursor-pointer"
              >
                Restart Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
