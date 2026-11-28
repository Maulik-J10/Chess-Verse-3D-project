import React, { useState } from 'react';
import { ChessRoom } from './scenes/ChessRoom';
import { MainMenu } from './components/MainMenu';
import { GameHUD } from './components/GameHUD';
import { RoomLobby } from './components/RoomLobby';
import { GameResult } from './components/GameResult';
import { PawnPromotionModal } from './components/PawnPromotionModal';
import { SettingsModal } from './components/SettingsModal';
import { RulesModal } from './components/RulesModal';
import { Preloader } from './components/Preloader';
import { PerformanceOverlay } from './components/PerformanceOverlay';
import { useGameStore } from './store/gameStore';

export const App: React.FC = () => {
  const gameMode = useGameStore((s) => s.gameMode);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

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

      {/* Screen Layer: Online Multiplayer Lobby (Create / Join Room) */}
      {gameMode === 'lobby' && <RoomLobby />}

      {/* Screen Layer: Active Game HUD (AI or Online Multiplayer) */}
      {(gameMode === 'ai' || gameMode === 'friend') && (
        <GameHUD
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenRules={() => setIsRulesOpen(true)}
        />
      )}

      {/* Overlays and Modals */}
      <PerformanceOverlay />
      <PawnPromotionModal />
      <GameResult />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
    </div>
  );
};

export default App;

