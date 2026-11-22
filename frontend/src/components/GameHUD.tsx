import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { soundManager } from '../audio/soundManager';
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
  Camera,
  History,
  X
} from 'lucide-react';
import { CameraPreset } from '../chess/types';

interface GameHUDProps {
  onOpenSettings: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({ onOpenSettings }) => {
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showMobileHistory, setShowMobileHistory] = useState(false);
  const [showMobileCamera, setShowMobileCamera] = useState(false);

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
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2 sm:p-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] select-none z-20 overflow-hidden">
      
      {/* ============================================================== */}
      {/* TOP BAR (DESKTOP: lg+) */}
      {/* ============================================================== */}
      <header className="pointer-events-auto hidden lg:flex items-center justify-between gap-3 w-full max-w-6xl mx-auto">
        {/* Game Mode & Title Badge */}
        <div className="flex items-center gap-3 bg-[#f7f7f4]/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-[#c6a45c]/35 shadow-royal-card">
          <button
            onClick={returnToMenu}
            className="flex items-center gap-1.5 text-xs text-[#666762] hover:text-[#202226] transition-colors cursor-pointer"
            title="Return to Main Menu"
          >
            <Home className="w-4 h-4 text-[#c6a45c]" />
            <span className="font-serif font-bold text-[#202226]">CHESSVERSE3D</span>
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

      {/* ============================================================== */}
      {/* TOP BAR (MOBILE & TABLET: < lg) — COMPACT, ZERO BOARD OCCLUSION */}
      {/* ============================================================== */}
      <div className="pointer-events-auto flex lg:hidden flex-col gap-1.5 w-full">
        {/* Navigation & Controls Row */}
        <div className="flex items-center justify-between gap-2 bg-[#f7f7f4]/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-[#c6a45c]/35 shadow-royal-card">
          <button
            onClick={returnToMenu}
            className="flex items-center gap-1 text-xs text-[#202226] font-serif font-bold p-1 cursor-pointer"
            title="Return to Menu"
          >
            <Home className="w-4 h-4 text-[#c6a45c]" />
            <span className="text-[11px] tracking-wide">MENU</span>
          </button>

          {/* Turn indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 border border-[#c6a45c]/30 text-[11px] font-serif font-bold">
            <span
              className={`w-2 h-2 rounded-full ${
                turn === 'w' ? 'bg-white border border-[#999]' : 'bg-[#202226]'
              }`}
            />
            <span className={isMyTurn ? 'text-[#c6a45c]' : 'text-[#666762]'}>
              {isThinking ? 'AI Thinking...' : isMyTurn ? 'Your Turn' : "Enemy's Turn"}
            </span>
          </div>

          {/* Quick Action Icons with 1-tap Camera Reset */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setCameraPreset('front');
                soundManager.playClick();
              }}
              className="p-1.5 rounded-lg bg-white border border-[#d6d6d2] text-[#202226] active:scale-95 cursor-pointer"
              title="Reset Camera to Front View"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#c6a45c]" />
            </button>

            <button
              onClick={() => setShowMobileCamera(true)}
              className="p-1.5 rounded-lg bg-white border border-[#d6d6d2] text-[#202226] active:scale-95 cursor-pointer"
              title="Camera View Options"
            >
              <Camera className="w-3.5 h-3.5 text-[#c6a45c]" />
            </button>

            <button
              onClick={toggleSound}
              className="p-1.5 rounded-lg bg-white border border-[#d6d6d2] text-[#202226] active:scale-95 cursor-pointer"
              title={soundEnabled ? 'Mute' : 'Unmute'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#c6a45c]" /> : <VolumeX className="w-3.5 h-3.5 text-[#a7a8a5]" />}
            </button>

            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-lg bg-white border border-[#d6d6d2] text-[#202226] active:scale-95 cursor-pointer"
              title="Settings"
            >
              <Compass className="w-3.5 h-3.5 text-[#c6a45c]" />
            </button>
          </div>
        </div>

        {/* Opponent Mobile Player Bar */}
        <div className="flex items-center justify-between gap-2 bg-[#f7f7f4]/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#c6a45c]/25 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-3 h-3 rounded-full shrink-0 border ${
                playerColor === 'w' ? 'bg-[#202226] border-black' : 'bg-white border-[#ccc]'
              }`}
            />
            <span className="font-serif font-bold text-xs text-[#202226] truncate">
              {opponentName}
            </span>
            <div className="scale-75 origin-left">
              <CapturedPieces
                captured={playerColor === 'w' ? capturedBlack : capturedWhite}
                advantage={playerColor === 'w' ? (materialAdvantage < 0 ? Math.abs(materialAdvantage) : 0) : (materialAdvantage > 0 ? materialAdvantage : 0)}
              />
            </div>
          </div>

          <div className="shrink-0 scale-90 origin-right">
            <GameClock
              color={playerColor === 'w' ? 'b' : 'w'}
              timeMs={playerColor === 'w' ? blackTimeMs : whiteTimeMs}
              isActive={turn !== playerColor}
              playerName=""
            />
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* DESKTOP MIDDLE WORKSPACE (PLAYERS & PANELS) */}
      {/* ============================================================== */}
      <div className="pointer-events-none hidden lg:flex items-start justify-between w-full max-w-6xl mx-auto my-auto gap-4">
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
        <div className="pointer-events-auto flex flex-col gap-3 w-64">
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

      {/* ============================================================== */}
      {/* BOTTOM ACTION BAR (DESKTOP: lg+) */}
      {/* ============================================================== */}
      <footer className="pointer-events-auto hidden lg:flex items-center justify-between w-full max-w-6xl mx-auto gap-2 bg-[#f7f7f4]/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-[#c6a45c]/35 shadow-royal-card text-xs">
        {/* Left Side Game Actions */}
        <div className="flex items-center gap-2">
          {gameMode === 'ai' && (
            <button
              onClick={undoMove}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-[#c6a45c]/10 border border-[#d6d6d2] text-[#202226] font-medium transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Undo Move (Takeback)"
            >
              <Undo2 className="w-3.5 h-3.5 text-[#c6a45c]" />
              <span>Undo Move</span>
            </button>
          )}

          <button
            onClick={offerDraw}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-[#c6a45c]/10 border border-[#d6d6d2] text-[#202226] font-medium transition-all cursor-pointer active:scale-95 shadow-sm"
            title="Offer Draw"
          >
            <Handshake className="w-3.5 h-3.5 text-[#c6a45c]" />
            <span>Offer Draw</span>
          </button>

          <button
            onClick={() => setShowResignConfirm(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-medium transition-all cursor-pointer active:scale-95 shadow-sm"
            title="Resign Game"
          >
            <Flag className="w-3.5 h-3.5 text-red-500" />
            <span>Resign</span>
          </button>
        </div>

        {/* Right Side Options */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewGameConfirm(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#c6a45c] hover:bg-[#b5934a] text-white font-serif font-bold transition-all cursor-pointer active:scale-95 shadow-glow-gold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>New Game</span>
          </button>
        </div>
      </footer>

      {/* ============================================================== */}
      {/* BOTTOM ACTION BAR (MOBILE & TABLET: < lg) — COMPACT, USER CLOCK + ACTIONS */}
      {/* ============================================================== */}
      <footer className="pointer-events-auto flex lg:hidden flex-col gap-1.5 w-full">
        {/* User Mobile Player Bar */}
        <div className="flex items-center justify-between gap-2 bg-[#f7f7f4]/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#c6a45c]/35 shadow-royal-card">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-3 h-3 rounded-full shrink-0 border ${
                playerColor === 'w' ? 'bg-white border-[#ccc]' : 'bg-[#202226] border-black'
              }`}
            />
            <span className="font-serif font-bold text-xs text-[#202226]">
              You ({playerColor === 'w' ? 'White' : 'Black'})
            </span>
            <div className="scale-75 origin-left">
              <CapturedPieces
                captured={playerColor === 'w' ? capturedWhite : capturedBlack}
                advantage={playerColor === 'w' ? (materialAdvantage > 0 ? materialAdvantage : 0) : (materialAdvantage < 0 ? Math.abs(materialAdvantage) : 0)}
              />
            </div>
          </div>

          <div className="shrink-0 scale-90 origin-right">
            <GameClock
              color={playerColor}
              timeMs={playerColor === 'w' ? whiteTimeMs : blackTimeMs}
              isActive={turn === playerColor}
              playerName=""
            />
          </div>
        </div>

        {/* Bottom Actions Row (min 44px touch targets) */}
        <div className="flex items-center justify-between gap-1.5 bg-[#f7f7f4]/95 backdrop-blur-md px-2 py-1.5 rounded-2xl border border-[#c6a45c]/35 shadow-royal-card">
          <div className="flex items-center gap-1">
            {gameMode === 'ai' && (
              <button
                onClick={undoMove}
                className="flex items-center justify-center min-w-[40px] h-10 px-2.5 rounded-xl bg-white active:bg-gray-100 border border-[#d6d6d2] text-[#202226] font-medium text-xs cursor-pointer"
                title="Undo Move"
              >
                <Undo2 className="w-4 h-4 text-[#c6a45c]" />
              </button>
            )}

            <button
              onClick={() => setShowMobileHistory(true)}
              className="flex items-center justify-center min-w-[40px] h-10 px-2.5 rounded-xl bg-white active:bg-gray-100 border border-[#d6d6d2] text-[#202226] font-medium text-xs cursor-pointer"
              title="Move History"
            >
              <History className="w-4 h-4 text-[#666762]" />
            </button>

            <button
              onClick={offerDraw}
              className="flex items-center justify-center min-w-[40px] h-10 px-2 rounded-xl bg-white active:bg-gray-100 border border-[#d6d6d2] text-[#202226] font-medium text-xs cursor-pointer"
              title="Offer Draw"
            >
              <Handshake className="w-4 h-4 text-[#666762]" />
            </button>

            <button
              onClick={() => setShowResignConfirm(true)}
              className="flex items-center justify-center min-w-[40px] h-10 px-2 rounded-xl bg-red-50 active:bg-red-100 border border-red-200 text-red-700 font-medium text-xs cursor-pointer"
              title="Resign"
            >
              <Flag className="w-4 h-4 text-red-500" />
            </button>
          </div>

          <button
            onClick={() => setShowNewGameConfirm(true)}
            className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-[#c6a45c] active:bg-[#b5934a] text-white font-serif font-bold text-xs uppercase tracking-wider cursor-pointer shadow-glow-gold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>New Game</span>
          </button>
        </div>
      </footer>

      {/* ============================================================== */}
      {/* MOBILE CAMERA VIEWS DRAWER */}
      {/* ============================================================== */}
      {showMobileCamera && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-3 pb-[max(1rem,env(safe-area-inset-bottom))] animate-fade-in">
          <div className="w-full max-w-sm bg-[#f7f7f4] border border-[#c6a45c]/50 rounded-3xl p-5 shadow-2xl text-[#202226]">
            <div className="flex items-center justify-between pb-3 border-b border-[#c6a45c]/20 mb-3">
              <div className="flex items-center gap-1.5 font-serif font-bold text-sm text-[#202226]">
                <Camera className="w-4 h-4 text-[#c6a45c]" />
                <span>CHOOSE CAMERA VIEW</span>
              </div>
              <button
                onClick={() => setShowMobileCamera(false)}
                className="p-1 rounded-lg hover:bg-black/5 text-[#666762] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {cameraButtons.map((btn) => (
                <button
                  key={btn.preset}
                  onClick={() => {
                    setCameraPreset(btn.preset);
                    soundManager.playClick();
                    setShowMobileCamera(false);
                  }}
                  className={`h-11 rounded-xl text-xs font-serif font-bold transition-all cursor-pointer flex items-center justify-center ${
                    cameraPreset === btn.preset
                      ? 'bg-[#c6a45c] text-white shadow-glow-gold'
                      : 'bg-white border border-[#d6d6d2] text-[#202226] active:bg-[#c6a45c]/10'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Direct Reset View Button */}
            <button
              onClick={() => {
                setCameraPreset('front');
                soundManager.playClick();
                setShowMobileCamera(false);
              }}
              className="w-full mt-3 py-2.5 rounded-xl bg-white active:bg-[#c6a45c]/10 border border-[#c6a45c]/50 text-[#202226] font-serif font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#c6a45c]" />
              <span>Reset to Default View</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MOBILE MOVE HISTORY DRAWER */}
      {/* ============================================================== */}
      {showMobileHistory && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#f7f7f4] border border-[#c6a45c]/50 rounded-3xl p-5 shadow-2xl text-[#202226] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#c6a45c]/20 mb-3">
              <div className="flex items-center gap-1.5 font-serif font-bold text-sm text-[#202226]">
                <History className="w-4 h-4 text-[#c6a45c]" />
                <span>NOTATION & MOVES</span>
              </div>
              <button
                onClick={() => setShowMobileHistory(false)}
                className="p-1 rounded-lg hover:bg-black/5 text-[#666762] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <MoveHistory />
            </div>
          </div>
        </div>
      )}

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
                className="flex-1 h-11 rounded-xl bg-white active:bg-gray-100 text-[#202226] border border-[#d6d6d2] text-xs font-semibold cursor-pointer"
              >
                Continue Playing
              </button>
              <button
                onClick={() => {
                  setShowResignConfirm(false);
                  resign();
                }}
                className="flex-1 h-11 rounded-xl bg-red-600 active:bg-red-500 text-white text-xs font-bold cursor-pointer"
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
                className="flex-1 h-11 rounded-xl bg-white active:bg-gray-100 text-[#202226] border border-[#d6d6d2] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowNewGameConfirm(false);
                  resetGame();
                }}
                className="flex-1 h-11 rounded-xl bg-[#c6a45c] active:bg-[#b5934a] text-white text-xs font-serif font-bold cursor-pointer"
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
