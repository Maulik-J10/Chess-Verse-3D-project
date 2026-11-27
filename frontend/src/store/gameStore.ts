import { create } from 'zustand';
import { 
  AIDifficulty, 
  CameraPreset, 
  GameMode, 
  GraphicsQuality, 
  LegalMoveInfo, 
  MoveHistoryItem, 
  PieceColor, 
  PieceData, 
  PieceType, 
  TimeControlPreset, 
  TIME_CONTROLS 
} from '../chess/types';
import { ChessLogicController } from '../chess/chessLogic';
import { stockfishEngine } from '../chess/stockfishEngine';
import { soundManager } from '../audio/soundManager';
import { socketClient, RoomData } from '../multiplayer/socketClient';
import { detectDeviceCapabilities } from '../utils/deviceTier';

interface GameState {
  // Mode & Position
  gameMode: GameMode;
  fen: string;
  turn: PieceColor;
  playerColor: PieceColor;
  opponentName: string;
  pieces: PieceData[];

  // Board Interaction
  selectedSquare: string | null;
  legalMoves: LegalMoveInfo[];
  lastMove: { from: string; to: string } | null;
  kingInCheckSquare: string | null;
  promotionPending: { from: string; to: string } | null;

  // History & Analysis
  history: MoveHistoryItem[];
  historyIndex: number; // -1 means live position

  // HUD & Evaluation
  capturedWhite: PieceType[];
  capturedBlack: PieceType[];
  materialAdvantage: number;
  isThinking: boolean;

  // Clocks
  timeControl: TimeControlPreset;
  whiteTimeMs: number;
  blackTimeMs: number;
  isClockRunning: boolean;

  // Settings & Visuals
  difficulty: AIDifficulty;
  cameraPreset: CameraPreset;
  isFlipped: boolean;
  soundEnabled: boolean;
  showHints: boolean;
  showLegalMoves: boolean;
  graphicsQuality: GraphicsQuality;
  showPerfOverlay: boolean;
  isMobile: boolean;
  isMoveHistoryOpen: boolean;
  isCameraDrawerOpen: boolean;

  // Game Result
  gameResult: {
    isOver: boolean;
    title: string;
    details: string;
    winner?: PieceColor | 'draw';
    reason?: string;
  } | null;

  // Multiplayer
  multiplayer: {
    roomCode?: string;
    roomId?: string;
    isCreator?: boolean;
    opponentConnected?: boolean;
    opponentDisconnected?: boolean;
    gracePeriod?: number;
    drawOffered?: boolean;
    drawOfferedByMe?: boolean;
  };

  // Actions
  setGameMode: (mode: GameMode) => void;
  startAiGame: (preferredColor: 'w' | 'b' | 'random', diff: AIDifficulty, tc: TimeControlPreset) => void;
  startMultiplayerGame: (room: RoomData, color: PieceColor, tc: TimeControlPreset, isCreator: boolean) => void;
  selectSquare: (square: string | null) => void;
  requestMove: (from: string, to: string, promotion?: PieceType, fromRemote?: boolean) => void;
  executePromotion: (promoPiece: PieceType) => void;
  cancelPromotion: () => void;
  undoMove: () => void;
  resign: () => void;
  offerDraw: () => void;
  acceptDraw: () => void;
  rejectDraw: () => void;
  setCameraPreset: (preset: CameraPreset) => void;
  flipBoard: () => void;
  setHistoryIndex: (index: number) => void;
  setGraphicsQuality: (quality: GraphicsQuality) => void;
  togglePerfOverlay: () => void;
  toggleMoveHistory: () => void;
  setMoveHistoryOpen: (open: boolean) => void;
  toggleCameraDrawer: () => void;
  setCameraDrawerOpen: (open: boolean) => void;
  adaptiveQualityDegrade: () => void;
  setIsMobile: (isMobile: boolean) => void;
  toggleSound: () => void;
  toggleHints: () => void;
  toggleLegalMoves: () => void;
  setDifficulty: (diff: AIDifficulty) => void;
  tickClock: (elapsedMs: number) => void;
  resetGame: () => void;
  returnToMenu: () => void;
}

const chessController = new ChessLogicController();

export const checkIsMobile = (): boolean => {
  return detectDeviceCapabilities().isMobileViewport;
};

const initialDeviceProfile = detectDeviceCapabilities();

export const useGameStore = create<GameState>((set, get) => {
  // Listen for engine moves in AI mode
  stockfishEngine.onBestMove((move) => {
    const state = get();
    if (state.gameMode === 'ai' && !state.gameResult?.isOver) {
      get().requestMove(move.from, move.to, move.promotion as PieceType | undefined);
    }
  });

  stockfishEngine.onThinking((thinking) => {
    set({ isThinking: thinking });
  });

  return {
    gameMode: 'menu',
    fen: chessController.getFen(),
    turn: 'w',
    playerColor: 'w',
    opponentName: 'Stockfish 19 NNUE',
    pieces: chessController.getPieces(),

    selectedSquare: null,
    legalMoves: [],
    lastMove: null,
    kingInCheckSquare: null,
    promotionPending: null,

    history: [],
    historyIndex: -1,

    capturedWhite: [],
    capturedBlack: [],
    materialAdvantage: 0,
    isThinking: false,

    timeControl: TIME_CONTROLS[5], // Rapid 10+0 default
    whiteTimeMs: 10 * 60 * 1000,
    blackTimeMs: 10 * 60 * 1000,
    isClockRunning: false,

    difficulty: 'maximum',
    cameraPreset: 'front',
    isFlipped: false,
    soundEnabled: true,
    showHints: true,
    showLegalMoves: true,
    graphicsQuality: initialDeviceProfile.recommendedQuality,
    showPerfOverlay: false,
    isMobile: initialDeviceProfile.isMobileViewport,
    isMoveHistoryOpen: false,
    isCameraDrawerOpen: false,

    gameResult: null,

    multiplayer: {},

    setGameMode: (mode) => set({ gameMode: mode }),

    startAiGame: (preferredColor, diff, tc) => {
      chessController.reset();
      stockfishEngine.setDifficulty(diff);

      let pColor: PieceColor = 'w';
      if (preferredColor === 'b') pColor = 'b';
      else if (preferredColor === 'random') pColor = Math.random() < 0.5 ? 'w' : 'b';

      const initialMs = tc.minutes * 60 * 1000;

      set({
        gameMode: 'ai',
        fen: chessController.getFen(),
        turn: 'w',
        playerColor: pColor,
        opponentName: `Stockfish (${diff.toUpperCase()})`,
        pieces: chessController.getPieces(),
        selectedSquare: null,
        legalMoves: [],
        lastMove: null,
        kingInCheckSquare: null,
        promotionPending: null,
        history: [],
        historyIndex: -1,
        capturedWhite: [],
        capturedBlack: [],
        materialAdvantage: 0,
        isThinking: false,
        difficulty: diff,
        timeControl: tc,
        whiteTimeMs: initialMs,
        blackTimeMs: initialMs,
        isClockRunning: tc.minutes > 0,
        gameResult: null,
        isFlipped: pColor === 'b',
        cameraPreset: pColor === 'b' ? 'black' : 'white',
      });

      // If user plays as Black, engine moves first
      if (pColor === 'b') {
        stockfishEngine.calculateBestMove(chessController.getFen());
      }
    },

    startMultiplayerGame: (room, color, tc, isCreator) => {
      if (room.fen) {
        chessController.load(room.fen);
      } else {
        chessController.reset();
      }
      const initialMs = tc.minutes * 60 * 1000;
      const whiteTime = room.clock?.whiteTimeMs ?? initialMs;
      const blackTime = room.clock?.blackTimeMs ?? initialMs;
      const opponentSession = color === 'w' ? room.players?.black : room.players?.white;
      const opponentName = opponentSession?.name || (isCreator ? 'Challenger' : 'Room Host');

      set({
        gameMode: 'friend',
        fen: chessController.getFen(),
        turn: chessController.getTurn(),
        playerColor: color,
        opponentName,
        pieces: chessController.getPieces(),
        selectedSquare: null,
        legalMoves: [],
        lastMove: null,
        kingInCheckSquare: chessController.inCheck() ? chessController.getKingSquare(chessController.getTurn()) : null,
        promotionPending: null,
        history: [],
        historyIndex: -1,
        capturedWhite: [],
        capturedBlack: [],
        materialAdvantage: 0,
        isThinking: false,
        timeControl: tc,
        whiteTimeMs: whiteTime,
        blackTimeMs: blackTime,
        isClockRunning: tc.minutes > 0,
        gameResult: null,
        isFlipped: color === 'b',
        cameraPreset: color === 'b' ? 'black' : 'white',
        multiplayer: {
          roomCode: room.roomCode,
          roomId: room.roomId,
          isCreator,
          opponentConnected: true,
          opponentDisconnected: false,
        },
      });

      // Register socket listeners for multiplayer room
      const s = socketClient.getSocket();
      if (s) {
        s.off('game:move');
        s.off('game:check');
        s.off('game:checkmate');
        s.off('game:draw');
        s.off('game:resign');
        s.off('game:finished');
        s.off('game:offer-draw');
        s.off('game:accept-draw');
        s.off('game:reject-draw');
        s.off('room:opponent-disconnected');
        s.off('room:opponent-reconnected');
        s.off('connect');

        // Auto-reconnect on transient network drop during active multiplayer match
        s.on('connect', () => {
          const cur = get();
          if (cur.gameMode === 'friend' && !cur.gameResult?.isOver && cur.multiplayer.roomId) {
            socketClient.reconnectRoom((res) => {
              if (res.success && res.room) {
                chessController.load(res.room.fen);
                const evalData = chessController.getCapturedAndAdvantage();
                set({
                  fen: res.room.fen,
                  turn: chessController.getTurn(),
                  pieces: chessController.getPieces(),
                  capturedWhite: evalData.whiteCaptured,
                  capturedBlack: evalData.blackCaptured,
                  materialAdvantage: evalData.whiteAdvantage,
                  whiteTimeMs: res.room.clock?.whiteTimeMs ?? get().whiteTimeMs,
                  blackTimeMs: res.room.clock?.blackTimeMs ?? get().blackTimeMs,
                });
              }
            });
          }
        });

        s.on('game:move', (data: any) => {
          const move = data?.move;
          if (!move) return;

          // Skip duplicate local execution if we already applied our own optimistic move,
          // while still syncing authoritative server clock times.
          if (data.fen && chessController.getFen() === data.fen) {
            if (data.clock) {
              set({
                whiteTimeMs: data.clock.whiteTimeMs,
                blackTimeMs: data.clock.blackTimeMs,
                isClockRunning: !!data.clock.isRunning && get().timeControl.minutes > 0,
              });
            }
            return;
          }

          get().requestMove(move.from, move.to, move.promotion as PieceType | undefined, true);
          if (data.clock) {
            set({
              whiteTimeMs: data.clock.whiteTimeMs,
              blackTimeMs: data.clock.blackTimeMs,
              isClockRunning: !!data.clock.isRunning && get().timeControl.minutes > 0,
            });
          }
        });

        s.on('game:offer-draw', () => {
          set((prev) => ({
            multiplayer: { ...prev.multiplayer, drawOffered: true },
          }));
        });

        s.on('game:accept-draw', () => {
          soundManager.playDraw();
          set({
            gameResult: {
              isOver: true,
              title: 'Draw Agreed',
              details: 'Both players mutually agreed to a draw.',
              winner: 'draw',
            },
            isClockRunning: false,
          });
        });

        s.on('game:reject-draw', () => {
          set((prev) => ({
            multiplayer: { ...prev.multiplayer, drawOfferedByMe: false },
          }));
        });

        s.on('game:resign', (data: any) => {
          const state = get();
          if (state.gameResult?.isOver) return;

          const winner = data.winner;
          const won = winner === state.playerColor;
          try {
            if (won) soundManager.playVictory();
            else soundManager.playDefeat();
          } catch (e) {
            // Audio safe fallback
          }

          set({
            gameResult: {
              isOver: true,
              title: won ? 'Opponent Resigned' : 'Resignation',
              details: won
                ? 'Your opponent has surrendered. Royal Victory!'
                : `${winner === 'w' ? 'White' : 'Black'} wins by resignation!`,
              winner,
            },
            isClockRunning: false,
          });
        });

        s.on('game:finished', (data: any) => {
          const state = get();
          if (state.gameResult?.isOver) return;
          if (data?.reason === 'timeout') {
            const winner = data.winner as PieceColor;
            set({
              gameResult: {
                isOver: true,
                title: 'Time Out',
                details: `${winner === 'w' ? 'Black' : 'White'} ran out of time! ${winner === 'w' ? 'White' : 'Black'} wins.`,
                winner,
              },
              isClockRunning: false,
            });
          }
        });

        s.on('room:opponent-disconnected', (data: any) => {
          set((prev) => ({
            multiplayer: {
              ...prev.multiplayer,
              opponentConnected: false,
              opponentDisconnected: true,
              gracePeriod: data.gracePeriodSeconds || 60,
            },
          }));
        });

        s.on('room:opponent-reconnected', () => {
          set((prev) => ({
            multiplayer: {
              ...prev.multiplayer,
              opponentConnected: true,
              opponentDisconnected: false,
              gracePeriod: undefined,
            },
          }));
        });
      }
    },

    selectSquare: (square) => {
      const state = get();
      if (state.gameResult?.isOver) return;

      // In multiplayer or AI, only allow selecting own pieces on own turn
      if (state.turn !== state.playerColor && state.gameMode !== 'menu') {
        return;
      }

      if (!square) {
        set({ selectedSquare: null, legalMoves: [] });
        return;
      }

      // If square already selected, deselect
      if (state.selectedSquare === square) {
        set({ selectedSquare: null, legalMoves: [] });
        return;
      }

      // If a piece is already selected, check if clicked square is a legal destination
      if (state.selectedSquare) {
        const legalDest = state.legalMoves.find((m) => m.to === square);
        if (legalDest) {
          // Check pawn promotion
          if (chessController.isPromotionMove(state.selectedSquare, square)) {
            set({ promotionPending: { from: state.selectedSquare, to: square } });
            return;
          }
          get().requestMove(state.selectedSquare, square);
          return;
        }
      }

      // Check if square has a friendly piece
      const pieces = chessController.getPieces();
      const piece = pieces.find((p) => p.square === square);

      if (piece && piece.color === state.turn) {
        soundManager.playSelect();
        const legals = chessController.getLegalMovesForSquare(square);
        set({ selectedSquare: square, legalMoves: legals });
      } else {
        set({ selectedSquare: null, legalMoves: [] });
      }
    },

    requestMove: (from, to, promotion, fromRemote = false) => {
      const state = get();
      if (state.gameResult?.isOver) return;

      const prevFen = chessController.getFen();
      const prevHistory = state.history;
      const moveRes = chessController.makeMove(from, to, promotion);
      if (!moveRes.success) return;

      // In live multiplayer, submit own move to authoritative backend and roll back if rejected
      if (!fromRemote && state.gameMode === 'friend' && state.turn === state.playerColor) {
        socketClient.sendMove(from, to, promotion, (res) => {
          if (res && res.success === false) {
            chessController.load(prevFen);
            const rollbackEval = chessController.getCapturedAndAdvantage();
            set({
              fen: prevFen,
              turn: chessController.getTurn(),
              pieces: chessController.getPieces(),
              selectedSquare: null,
              legalMoves: [],
              history: prevHistory,
              capturedWhite: rollbackEval.whiteCaptured,
              capturedBlack: rollbackEval.blackCaptured,
              materialAdvantage: rollbackEval.whiteAdvantage,
              kingInCheckSquare: chessController.inCheck()
                ? chessController.getKingSquare(chessController.getTurn())
                : null,
            });
          }
        });
      }

      // Play appropriate sound
      if (chessController.isCheckmate()) {
        soundManager.playCheckmate();
      } else if (moveRes.isPromotion) {
        soundManager.playPromotion();
      } else if (moveRes.isCastle) {
        soundManager.playCastling();
      } else if (moveRes.captured) {
        soundManager.playCapture();
      } else if (chessController.inCheck()) {
        soundManager.playCheck();
      } else {
        soundManager.playMove();
      }

      const newFen = chessController.getFen();
      const nextTurn = chessController.getTurn();
      const evalData = chessController.getCapturedAndAdvantage();
      const statusDesc = chessController.getGameStatusDescription();

      const newHistoryItem: MoveHistoryItem = {
        san: moveRes.san || '',
        from,
        to,
        color: state.turn,
        fen: newFen,
        captured: moveRes.captured,
      };

      const newHistory = [...state.history, newHistoryItem];

      // Check king in check
      const checkedKingSquare = chessController.inCheck() 
        ? chessController.getKingSquare(nextTurn) 
        : null;

      // Increment clock for previous mover
      let newWhiteTime = state.whiteTimeMs;
      let newBlackTime = state.blackTimeMs;
      if (state.timeControl.increment > 0) {
        if (state.turn === 'w') newWhiteTime += state.timeControl.increment * 1000;
        else newBlackTime += state.timeControl.increment * 1000;
      }

      let result = null;
      if (statusDesc.isOver) {
        const won = statusDesc.winner === state.playerColor;
        if (won) soundManager.playVictory();
        else if (statusDesc.winner === 'draw') soundManager.playDraw();
        else soundManager.playDefeat();

        result = {
          isOver: true,
          title: statusDesc.title,
          details: statusDesc.details,
          winner: statusDesc.winner,
        };
      }

      set({
        fen: newFen,
        turn: nextTurn,
        pieces: chessController.getPieces(),
        selectedSquare: null,
        legalMoves: [],
        lastMove: { from, to },
        kingInCheckSquare: checkedKingSquare,
        promotionPending: null,
        history: newHistory,
        historyIndex: -1,
        capturedWhite: evalData.whiteCaptured,
        capturedBlack: evalData.blackCaptured,
        materialAdvantage: evalData.whiteAdvantage,
        whiteTimeMs: newWhiteTime,
        blackTimeMs: newBlackTime,
        gameResult: result,
        isClockRunning: !statusDesc.isOver && state.timeControl.minutes > 0,
      });

      // Trigger computer move if in AI mode and it's AI's turn
      if (state.gameMode === 'ai' && !statusDesc.isOver && nextTurn !== state.playerColor) {
        stockfishEngine.calculateBestMove(newFen);
      }
    },

    executePromotion: (promoPiece) => {
      const state = get();
      if (!state.promotionPending) return;
      get().requestMove(state.promotionPending.from, state.promotionPending.to, promoPiece);
    },

    cancelPromotion: () => {
      set({ promotionPending: null, selectedSquare: null, legalMoves: [] });
    },

    undoMove: () => {
      const state = get();
      if (state.gameMode !== 'ai' || state.gameResult?.isOver) return;

      // In AI mode, undo both computer move and player move
      chessController.undo();
      if (chessController.getTurn() !== state.playerColor) {
        chessController.undo();
      }

      const evalData = chessController.getCapturedAndAdvantage();
      const updatedHistory = state.history.slice(0, Math.max(0, state.history.length - 2));

      set({
        fen: chessController.getFen(),
        turn: chessController.getTurn(),
        pieces: chessController.getPieces(),
        selectedSquare: null,
        legalMoves: [],
        lastMove: updatedHistory.length > 0 ? { from: updatedHistory[updatedHistory.length - 1].from, to: updatedHistory[updatedHistory.length - 1].to } : null,
        kingInCheckSquare: chessController.inCheck() ? chessController.getKingSquare(chessController.getTurn()) : null,
        history: updatedHistory,
        historyIndex: -1,
        capturedWhite: evalData.whiteCaptured,
        capturedBlack: evalData.blackCaptured,
        materialAdvantage: evalData.whiteAdvantage,
        gameResult: null,
      });
      soundManager.playMove();
    },

    resign: () => {
      const state = get();
      if (state.gameResult?.isOver) return;

      if (state.gameMode === 'friend') {
        socketClient.resign();
      }

      const winner = state.playerColor === 'w' ? 'b' : 'w';
      try {
        soundManager.playDefeat();
      } catch (e) {
        // Safe fallback
      }

      set({
        gameResult: {
          isOver: true,
          title: 'Resignation',
          details: `You resigned the game. ${winner === 'w' ? 'White' : 'Black'} wins!`,
          winner,
        },
        isClockRunning: false,
      });
    },

    offerDraw: () => {
      const state = get();
      if (state.gameMode === 'friend') {
        socketClient.offerDraw();
        set((prev) => ({ multiplayer: { ...prev.multiplayer, drawOfferedByMe: true } }));
      } else if (state.gameMode === 'ai') {
        // AI evaluates draw based on material advantage
        if (Math.abs(state.materialAdvantage) <= 1) {
          soundManager.playDraw();
          set({
            gameResult: {
              isOver: true,
              title: 'Draw Agreed',
              details: 'The computer agreed to your draw offer.',
              winner: 'draw',
            },
            isClockRunning: false,
          });
        }
      }
    },

    acceptDraw: () => {
      const state = get();
      if (state.gameMode === 'friend') {
        socketClient.acceptDraw();
      }
      soundManager.playDraw();
      set({
        gameResult: {
          isOver: true,
          title: 'Draw Agreed',
          details: 'Both players mutually agreed to a draw.',
          winner: 'draw',
        },
        isClockRunning: false,
        multiplayer: { ...state.multiplayer, drawOffered: false },
      });
    },

    rejectDraw: () => {
      const state = get();
      if (state.gameMode === 'friend') {
        socketClient.rejectDraw();
      }
      set((prev) => ({
        multiplayer: { ...prev.multiplayer, drawOffered: false },
      }));
    },

    setCameraPreset: (preset) => set({ cameraPreset: preset }),
    flipBoard: () => set((prev) => ({ isFlipped: !prev.isFlipped })),

    setHistoryIndex: (index) => {
      const state = get();
      if (index === -1 || index >= state.history.length - 1) {
        // Return to live position
        chessController.load(state.fen);
        set({
          historyIndex: -1,
          pieces: chessController.getPieces(),
        });
      } else {
        // Preview past board position
        const targetMove = state.history[index];
        if (targetMove) {
          const preview = new ChessLogicController(targetMove.fen);
          set({
            historyIndex: index,
            pieces: preview.getPieces(),
          });
        }
      }
    },

    setGraphicsQuality: (quality) => set({ graphicsQuality: quality }),
    togglePerfOverlay: () => set((s) => ({ showPerfOverlay: !s.showPerfOverlay })),
    toggleMoveHistory: () => set((s) => ({ isMoveHistoryOpen: !s.isMoveHistoryOpen })),
    setMoveHistoryOpen: (open) => set({ isMoveHistoryOpen: open }),
    toggleCameraDrawer: () => set((s) => ({ isCameraDrawerOpen: !s.isCameraDrawerOpen })),
    setCameraDrawerOpen: (open) => set({ isCameraDrawerOpen: open }),
    setIsMobile: (mobile) => set({ isMobile: mobile }),
    adaptiveQualityDegrade: () => {
      const q = get().graphicsQuality;
      if (q === 'ultra') set({ graphicsQuality: 'high' });
      else if (q === 'high') set({ graphicsQuality: 'medium' });
      else if (q === 'medium') set({ graphicsQuality: 'low' });
    },

    toggleSound: () => {
      const muted = soundManager.getMuted();
      soundManager.setMuted(!muted);
      set({ soundEnabled: muted });
    },

    toggleHints: () => set((prev) => ({ showHints: !prev.showHints })),
    toggleLegalMoves: () => set((prev) => ({ showLegalMoves: !prev.showLegalMoves })),
    setDifficulty: (diff) => {
      stockfishEngine.setDifficulty(diff);
      set({ difficulty: diff });
    },

    tickClock: (elapsedMs) => {
      const state = get();
      if (!state.isClockRunning || state.gameResult?.isOver) return;

      if (state.turn === 'w') {
        const nextTime = Math.max(0, state.whiteTimeMs - elapsedMs);
        if (nextTime <= 10000 && nextTime > 0) soundManager.playTick();
        if (nextTime === 0) {
          soundManager.playDefeat();
          set({
            whiteTimeMs: 0,
            isClockRunning: false,
            gameResult: {
              isOver: true,
              title: 'Time Out',
              details: 'White ran out of time! Black wins.',
              winner: 'b',
            },
          });
        } else {
          set({ whiteTimeMs: nextTime });
        }
      } else {
        const nextTime = Math.max(0, state.blackTimeMs - elapsedMs);
        if (nextTime <= 10000 && nextTime > 0) soundManager.playTick();
        if (nextTime === 0) {
          soundManager.playDefeat();
          set({
            blackTimeMs: 0,
            isClockRunning: false,
            gameResult: {
              isOver: true,
              title: 'Time Out',
              details: 'Black ran out of time! White wins.',
              winner: 'w',
            },
          });
        } else {
          set({ blackTimeMs: nextTime });
        }
      }
    },

    resetGame: () => {
      stockfishEngine.stop();
      chessController.reset();
      const state = get();
      const initialMs = state.timeControl.minutes * 60 * 1000;
      set({
        fen: chessController.getFen(),
        turn: 'w',
        pieces: chessController.getPieces(),
        selectedSquare: null,
        legalMoves: [],
        lastMove: null,
        kingInCheckSquare: null,
        promotionPending: null,
        history: [],
        historyIndex: -1,
        capturedWhite: [],
        capturedBlack: [],
        materialAdvantage: 0,
        isThinking: false,
        whiteTimeMs: initialMs,
        blackTimeMs: initialMs,
        isClockRunning: state.timeControl.minutes > 0,
        gameResult: null,
      });
      if (state.gameMode === 'ai' && state.playerColor === 'b') {
        stockfishEngine.calculateBestMove(chessController.getFen());
      }
    },

    returnToMenu: () => {
      stockfishEngine.stop();
      socketClient.disconnect();
      set({
        gameMode: 'menu',
        selectedSquare: null,
        legalMoves: [],
        isThinking: false,
        gameResult: null,
        multiplayer: {},
      });
    },
  };
});

