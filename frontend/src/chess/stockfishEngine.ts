import { Chess } from 'chess.js';
import { AIDifficulty, AI_DIFFICULTIES } from './types';

// Positional piece-square tables for lightweight emergency fallback engine
const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

const ROOK_TABLE = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0,
];

const QUEEN_TABLE = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
];

const KING_TABLE = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20,
];

export class StockfishEngineController {
  private worker: Worker | null = null;
  private isInitializing = false;
  private isWorkerReady = false;
  private workerFailed = false;
  private pendingSearch: { fen: string; depth: number; movetime: number } | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  private onMoveCallback: ((move: { from: string; to: string; promotion?: string }) => void) | null = null;
  private onThinkingCallback: ((thinking: boolean) => void) | null = null;
  private currentDifficulty: AIDifficulty = 'maximum';

  /**
   * Lazily spawns Stockfish 19 WASM directly in a dedicated UCI Web Worker.
   * Avoids downloading/compiling the 1.8MB WASM binary during initial 3D menu load.
   */
  private initWorker() {
    if (typeof window === 'undefined' || this.worker || this.isInitializing || this.workerFailed) return;
    this.isInitializing = true;

    try {
      const baseHref = window.location.href;
      const jsUrl = new URL('stockfish/stockfish-19-lite-single.js', baseHref).href;
      const wasmUrl = new URL('stockfish/stockfish-19-lite-single.wasm', baseHref).href;

      // Spawn stockfish-19-lite-single directly as its native UCI Web Worker (non-blocking)
      this.worker = new Worker(`${jsUrl}#${encodeURIComponent(wasmUrl)}`);

      this.worker.onmessage = (e) => {
        const line = typeof e.data === 'string' ? e.data : e.data?.raw || '';
        if (!line) return;

        if (line === 'uciok') {
          this.configureEngine();
          this.worker?.postMessage('isready');
        } else if (line === 'readyok') {
          this.isWorkerReady = true;
          this.isInitializing = false;
          if (this.pendingSearch) {
            const req = this.pendingSearch;
            this.pendingSearch = null;
            this.dispatchWorkerSearch(req.fen, req.depth, req.movetime);
          }
        } else if (line.startsWith('bestmove')) {
          const parts = line.split(' ');
          const moveStr = parts[1];
          if (this.onThinkingCallback) this.onThinkingCallback(false);
          if (moveStr && moveStr !== '(none)') {
            const parsed = this.parseUciMove(moveStr);
            if (this.onMoveCallback) this.onMoveCallback(parsed);
          }
        }
      };

      this.worker.onerror = (err) => {
        console.warn('Stockfish WASM worker error, activating async JS fallback:', err);
        this.worker?.terminate();
        this.worker = null;
        this.isInitializing = false;
        this.isWorkerReady = false;
        this.workerFailed = true;

        if (this.pendingSearch) {
          const req = this.pendingSearch;
          this.pendingSearch = null;
          this.runFallbackSearch(req.fen, req.depth, req.movetime);
        }
      };

      this.worker.postMessage('uci');
    } catch (e) {
      console.warn('Worker initialization failed, using async fallback:', e);
      this.isInitializing = false;
      this.workerFailed = true;
      this.worker = null;
    }
  }

  public setDifficulty(diff: AIDifficulty) {
    this.currentDifficulty = diff;
    if (this.worker && this.isWorkerReady) {
      this.configureEngine();
    }
  }

  public getDifficulty(): AIDifficulty {
    return this.currentDifficulty;
  }

  private configureEngine() {
    if (!this.worker) return;
    const config = AI_DIFFICULTIES[this.currentDifficulty];
    this.worker.postMessage(`setoption name Skill Level value ${config.skillLevel}`);
  }

  public onBestMove(callback: (move: { from: string; to: string; promotion?: string }) => void) {
    this.onMoveCallback = callback;
  }

  public onThinking(callback: (thinking: boolean) => void) {
    this.onThinkingCallback = callback;
  }

  public stop() {
    this.pendingSearch = null;
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    if (this.worker && this.isWorkerReady) {
      this.worker.postMessage('stop');
    }
  }

  public calculateBestMove(fen: string) {
    if (this.onThinkingCallback) this.onThinkingCallback(true);

    const config = AI_DIFFICULTIES[this.currentDifficulty];

    if (!this.worker && !this.workerFailed) {
      this.initWorker();
    }

    if (this.worker && this.isWorkerReady) {
      this.dispatchWorkerSearch(fen, config.depth, config.movetime);
      return;
    }

    if (this.worker && !this.workerFailed) {
      // Queue move until WASM finishes ~200ms async init
      this.pendingSearch = { fen, depth: config.depth, movetime: config.movetime };
      return;
    }

    this.runFallbackSearch(fen, config.depth, config.movetime);
  }

  private dispatchWorkerSearch(fen: string, depth: number, movetime: number) {
    if (!this.worker) return;
    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`go depth ${depth} movetime ${movetime}`);
  }

  private runFallbackSearch(fen: string, depth: number, movetime: number) {
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
    this.fallbackTimer = setTimeout(() => {
      this.fallbackTimer = null;
      // Bounded fallback depth 2 so main thread stays snappy on mobile if WASM failed
      const best = this.calculateTacticalMove(fen, Math.min(depth, 2));
      if (this.onThinkingCallback) this.onThinkingCallback(false);
      if (best && this.onMoveCallback) {
        this.onMoveCallback(best);
      }
    }, Math.min(400, movetime));
  }

  private parseUciMove(uci: string): { from: string; to: string; promotion?: string } {
    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);
    const promotion = uci.length > 4 ? uci.substring(4, 5) : undefined;
    return { from, to, promotion };
  }

  private calculateTacticalMove(fen: string, maxDepth: number): { from: string; to: string; promotion?: string } | null {
    const game = new Chess(fen);
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    if (this.currentDifficulty === 'beginner' && Math.random() < 0.4) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      return { from: randomMove.from, to: randomMove.to, promotion: randomMove.promotion };
    }

    const isMaximizing = game.turn() === 'w';
    let bestMove = moves[0];
    let bestScore = isMaximizing ? -Infinity : Infinity;
    const depth = Math.min(maxDepth, 2);

    for (const move of moves) {
      game.move(move);
      const score = this.minimax(game, depth - 1, -Infinity, Infinity, !isMaximizing);
      game.undo();

      if (isMaximizing) {
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      } else {
        if (score < bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
    }

    return { from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion };
  }

  private minimax(game: Chess, depth: number, alpha: number, beta: number, isMaximizing: boolean): number {
    if (depth === 0 || game.isGameOver()) {
      return this.evaluateBoard(game);
    }

    const moves = game.moves({ verbose: true });
    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        game.move(move);
        const evalScore = this.minimax(game, depth - 1, alpha, beta, false);
        game.undo();
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        game.move(move);
        const evalScore = this.minimax(game, depth - 1, alpha, beta, true);
        game.undo();
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  private evaluateBoard(game: Chess): number {
    if (game.isCheckmate()) {
      return game.turn() === 'w' ? -100000 : 100000;
    }
    if (game.isDraw()) return 0;

    const pieceValues: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    let totalScore = 0;
    const board = game.board();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        const val = pieceValues[piece.type] || 0;
        let positionalScore = 0;
        const index = r * 8 + c;
        const mirrorIndex = (7 - r) * 8 + c;

        switch (piece.type) {
          case 'p': positionalScore = piece.color === 'w' ? PAWN_TABLE[mirrorIndex] : PAWN_TABLE[index]; break;
          case 'n': positionalScore = piece.color === 'w' ? KNIGHT_TABLE[mirrorIndex] : KNIGHT_TABLE[index]; break;
          case 'b': positionalScore = piece.color === 'w' ? BISHOP_TABLE[mirrorIndex] : BISHOP_TABLE[index]; break;
          case 'r': positionalScore = piece.color === 'w' ? ROOK_TABLE[mirrorIndex] : ROOK_TABLE[index]; break;
          case 'q': positionalScore = piece.color === 'w' ? QUEEN_TABLE[mirrorIndex] : QUEEN_TABLE[index]; break;
          case 'k': positionalScore = piece.color === 'w' ? KING_TABLE[mirrorIndex] : KING_TABLE[index]; break;
        }
        totalScore += piece.color === 'w' ? val + positionalScore : -(val + positionalScore);
      }
    }
    return totalScore;
  }
}

export const stockfishEngine = new StockfishEngineController();
