import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ChessRoom } from './scenes/ChessRoom';
import { MainMenu } from './components/MainMenu';
import { Preloader } from './components/Preloader';
import { useGameStore } from './store/gameStore';

const loadRoomLobby = () => import('./components/RoomLobby').then((m) => ({ default: m.RoomLobby }));
const loadGameHUD = () => import('./components/GameHUD').then((m) => ({ default: m.GameHUD }));
const loadGameResult = () => import('./components/GameResult').then((m) => ({ default: m.GameResult }));
const loadPawnPromotionModal = () =>
  import('./components/PawnPromotionModal').then((m) => ({ default: m.PawnPromotionModal }));
const loadSettingsModal = () => import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal }));
const loadRulesModal = () => import('./components/RulesModal').then((m) => ({ default: m.RulesModal }));
const loadPerformanceOverlay = () =>
  import('./components/PerformanceOverlay').then((m) => ({ default: m.PerformanceOverlay }));

const RoomLobby = lazy(loadRoomLobby);
const GameHUD = lazy(loadGameHUD);
const GameResult = lazy(loadGameResult);
const PawnPromotionModal = lazy(loadPawnPromotionModal);
const SettingsModal = lazy(loadSettingsModal);
const RulesModal = lazy(loadRulesModal);
const PerformanceOverlay = lazy(loadPerformanceOverlay);

export const App: React.FC = () => {
  const gameMode = useGameStore((s) => s.gameMode);
  const showPerfOverlay = useGameStore((s) => s.showPerfOverlay);
  const isOver = useGameStore((s) => !!s.gameResult?.isOver);
  const hasPromo = useGameStore((s) => !!s.promotionPending);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  // Idle-prefetch secondary UI chunks right after startup so modal & match clicks are instant
  useEffect(() => {
    const prefetch = () => {
      loadGameHUD();
      loadRoomLobby();
      loadSettingsModal();
      loadRulesModal();
    };
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(prefetch, { timeout: 1200 });
      return () => w.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(prefetch, 600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-[#121316]">
      {/* 1-Time Entry Preloader (2.0s duration with White & Black Kings and golden loading bar) */}
      <Preloader />

      {/* 3D Scene Environment (Main Chess Room & Board) */}
      <ChessRoom />

      {/* Screen Layer: Landing Menu */}
      {gameMode === 'menu' && (
        <MainMenu
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenRules={() => setIsRulesOpen(true)}
        />
      )}

      {/* Lazy-Loaded Game Screens & Overlays */}
      <Suspense fallback={null}>
        {gameMode === 'lobby' && <RoomLobby />}

        {(gameMode === 'ai' || gameMode === 'friend') && (
          <GameHUD
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenRules={() => setIsRulesOpen(true)}
          />
        )}

        {showPerfOverlay && <PerformanceOverlay />}
        {hasPromo && <PawnPromotionModal />}
        {isOver && <GameResult />}
        {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />}
        {isRulesOpen && <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />}
      </Suspense>
    </div>
  );
};

export default App;

