import { Chess } from 'chess.js';
import { AIDifficulty, AI_DIFFICULTIES } from './types';

// Positional piece-square tables for high-performance tactical fallback engine
const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50
];

const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20
];

const ROOK_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  5, 10, 10, 10, 10, 10, 10,  5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  0,  5,  5,  0,  0,  0
];

const QUEEN_TABLE = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20
];

const KING_TABLE = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20
];

export class StockfishEngineController {
  private worker: Worker | null = null;
  private isWorkerReady: boolean = false;
  private onMoveCallback: ((move: { from: string; to: string; promotion?: string }) => void) | null = null;
  private onThinkingCallback: ((thinking: boolean) => void) | null = null;
  private currentDifficulty: AIDifficulty = 'maximum';

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof window === 'undefined') return;

    try {
      const workerUrl = new URL('stockfishWorker.js', window.location.href).href;
      this.worker = new Worker(workerUrl);
      this.worker.onmessage = (e) => {
        const { type, move } = e.data;
        if (type === 'ready' || type === 'readyok') {
          this.isWorkerReady = true;
          this.configureEngine();
        } else if (type === 'bestmove') {
          if (this.onThinkingCallback) this.onThinkingCallback(false);
          if (move && move !== '(none)') {
            const parsed = this.parseUciMove(move);
            if (this.onMoveCallback) this.onMoveCallback(parsed);
          }
        }
      };

      this.worker.onerror = (err) => {
        console.warn('Stockfish Worker failed, using built-in AI engine fallback', err);
        this.worker = null;
        this.isWorkerReady = false;
      };

      this.worker.postMessage({ command: 'init' });
    } catch (e) {
      console.warn('Worker initialization error:', e);
      this.worker = null;
    }
  }

  public setDifficulty(diff: AIDifficulty) {
    this.currentDifficulty = diff;
    this.configureEngine();
  }

  public getDifficulty(): AIDifficulty {
    return this.currentDifficulty;
  }

  private configureEngine() {
    if (!this.worker || !this.isWorkerReady) return;
    const config = AI_DIFFICULTIES[this.currentDifficulty];

    this.worker.postMessage({
      command: 'setoption',
      data: { name: 'Skill Level', value: config.skillLevel },
    });
    this.worker.postMessage({
      command: 'setoption',
      data: { name: 'Threads', value: 2 },
    });
  }

  public onBestMove(callback: (move: { from: string; to: string; promotion?: string }) => void) {
    this.onMoveCallback = callback;
  }

  public onThinking(callback: (thinking: boolean) => void) {
    this.onThinkingCallback = callback;
  }

  public calculateBestMove(fen: string) {
    if (this.onThinkingCallback) this.onThinkingCallback(true);

    const config = AI_DIFFICULTIES[this.currentDifficulty];

    // If Stockfish worker is online, dispatch to worker
    if (this.worker && this.isWorkerReady) {
      this.worker.postMessage({
        command: 'position',
        data: { fen },
      });
      this.worker.postMessage({
        command: 'go',
        data: {
          depth: config.depth,
          movetime: config.movetime,
        },
      });
      return;
    }

    // High performance tactical fallback engine
    setTimeout(() => {
      const best = this.calculateTacticalMove(fen, config.depth);
      if (this.onThinkingCallback) this.onThinkingCallback(false);
      if (best && this.onMoveCallback) {
        this.onMoveCallback(best);
      }
    }, Math.min(800, config.movetime));
  }

  private parseUciMove(uci: string): { from: string; to: string; promotion?: string } {
    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);
    const promotion = uci.length > 4 ? uci.substring(4, 5) : undefined;
    return { from, to, promotion };
  }

  // TACTICAL ENGINE IMPLEMENTATION (Alpha-Beta with Minimax and Piece-Square Tables)
  private calculateTacticalMove(fen: string, maxDepth: number): { from: string; to: string; promotion?: string } | null {
    const game = new Chess(fen);
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    // Beginner or low difficulty: Introduce occasional blunders
    if (this.currentDifficulty === 'beginner' && Math.random() < 0.4) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      return { from: randomMove.from, to: randomMove.to, promotion: randomMove.promotion };
    }

    const isMaximizing = game.turn() === 'w';
    let bestMove = moves[0];
    let bestScore = isMaximizing ? -Infinity : Infinity;

    // Search depth bounded for browser responsiveness (depth 2-4)
    const depth = Math.min(maxDepth, 3);

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

    return {
      from: bestMove.from,
      to: bestMove.to,
      promotion: bestMove.promotion,
    };
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
    if (game.isDraw()) {
      return 0;
    }

    const pieceValues: Record<string, number> = {
      p: 100,
      n: 320,
      b: 330,
      r: 500,
      q: 900,
      k: 20000,
    };

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

        if (piece.color === 'w') {
          totalScore += val + positionalScore;
        } else {
          totalScore -= (val + positionalScore);
        }
      }
    }

    return totalScore;
  }
}

export const stockfishEngine = new StockfishEngineController();
