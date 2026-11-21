import { Chess, Square } from 'chess.js';
import { LegalMoveInfo, PieceColor, PieceType, PieceData } from './types';

export class ChessLogicController {
  private chess: Chess;

  constructor(fen?: string) {
    this.chess = fen ? new Chess(fen) : new Chess();
  }

  public reset(fen?: string) {
    if (fen) {
      this.chess.load(fen);
    } else {
      this.chess.reset();
    }
  }

  public load(fen: string): boolean {
    try {
      this.chess.load(fen);
      return true;
    } catch {
      return false;
    }
  }

  public getFen(): string {
    return this.chess.fen();
  }

  public getTurn(): PieceColor {
    return this.chess.turn() as PieceColor;
  }

  public inCheck(): boolean {
    return this.chess.inCheck();
  }

  public isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  public isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  public isThreefoldRepetition(): boolean {
    return this.chess.isThreefoldRepetition();
  }

  public isInsufficientMaterial(): boolean {
    return this.chess.isInsufficientMaterial();
  }

  public isDraw(): boolean {
    return this.chess.isDraw();
  }

  public isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  public getKingSquare(color: PieceColor): string | null {
    const board = this.chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === color) {
          const file = String.fromCharCode('a'.charCodeAt(0) + c);
          const rank = 8 - r;
          return `${file}${rank}`;
        }
      }
    }
    return null;
  }

  public getPieces(): PieceData[] {
    const board = this.chess.board();
    const pieces: PieceData[] = [];
    const counts: Record<string, number> = {};

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece) {
          const file = String.fromCharCode('a'.charCodeAt(0) + c);
          const rank = 8 - r;
          const sq = `${file}${rank}`;
          const key = `${piece.color}_${piece.type}`;
          counts[key] = (counts[key] || 0) + 1;
          const id = `${piece.color}_${piece.type}_${counts[key]}`;

          pieces.push({
            id,
            type: piece.type as PieceType,
            color: piece.color as PieceColor,
            square: sq,
          });
        }
      }
    }
    return pieces;
  }

  public getLegalMovesForSquare(square: string): LegalMoveInfo[] {
    const moves = this.chess.moves({ square: square as Square, verbose: true });
    return moves.map(m => ({
      from: m.from,
      to: m.to,
      san: m.san,
      captured: m.captured as PieceType | undefined,
      isEnPassant: m.flags.includes('e'),
      isCastle: m.flags.includes('k') || m.flags.includes('q'),
      promotion: m.promotion as PieceType | undefined,
    }));
  }

  public isPromotionMove(from: string, to: string): boolean {
    const piece = this.chess.get(from as Square);
    if (!piece || piece.type !== 'p') return false;

    const targetRank = to[1];
    return (piece.color === 'w' && targetRank === '8') || (piece.color === 'b' && targetRank === '1');
  }

  public makeMove(from: string, to: string, promotion?: PieceType): { success: boolean; san?: string; captured?: PieceType; isCastle?: boolean; isPromotion?: boolean; isEnPassant?: boolean } {
    try {
      const move = this.chess.move({
        from: from as Square,
        to: to as Square,
        promotion: promotion || undefined,
      });

      if (!move) return { success: false };

      return {
        success: true,
        san: move.san,
        captured: move.captured as PieceType | undefined,
        isCastle: move.flags.includes('k') || move.flags.includes('q'),
        isPromotion: move.flags.includes('p'),
        isEnPassant: move.flags.includes('e'),
      };
    } catch {
      return { success: false };
    }
  }

  public undo(): boolean {
    return !!this.chess.undo();
  }

  public getCapturedAndAdvantage(): {
    whiteCaptured: PieceType[];
    blackCaptured: PieceType[];
    whiteAdvantage: number;
  } {
    const initialPieces: Record<PieceType, number> = {
      p: 8,
      r: 2,
      n: 2,
      b: 2,
      q: 1,
      k: 1,
    };

    const currentWhite: Record<PieceType, number> = { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 };
    const currentBlack: Record<PieceType, number> = { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 };

    const board = this.chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece) {
          if (piece.color === 'w') {
            currentWhite[piece.type as PieceType]++;
          } else {
            currentBlack[piece.type as PieceType]++;
          }
        }
      }
    }

    const whiteCaptured: PieceType[] = []; // Black pieces taken by White
    const blackCaptured: PieceType[] = []; // White pieces taken by Black

    const pieceValues: Record<PieceType, number> = {
      p: 1,
      n: 3,
      b: 3,
      r: 5,
      q: 9,
      k: 0,
    };

    let whiteScore = 0;
    let blackScore = 0;

    (['p', 'n', 'b', 'r', 'q'] as PieceType[]).forEach(type => {
      // White pieces lost = taken by Black
      const whiteLost = initialPieces[type] - currentWhite[type];
      for (let i = 0; i < whiteLost; i++) blackCaptured.push(type);

      // Black pieces lost = taken by White
      const blackLost = initialPieces[type] - currentBlack[type];
      for (let i = 0; i < blackLost; i++) whiteCaptured.push(type);

      whiteScore += currentWhite[type] * pieceValues[type];
      blackScore += currentBlack[type] * pieceValues[type];
    });

    return {
      whiteCaptured,
      blackCaptured,
      whiteAdvantage: whiteScore - blackScore,
    };
  }

  public getGameStatusDescription(): {
    title: string;
    details: string;
    isOver: boolean;
    winner?: PieceColor | 'draw';
  } {
    if (this.chess.isCheckmate()) {
      const winner = this.chess.turn() === 'w' ? 'b' : 'w';
      return {
        title: 'Checkmate',
        details: `${winner === 'w' ? 'White' : 'Black'} wins by checkmate!`,
        isOver: true,
        winner,
      };
    }
    if (this.chess.isStalemate()) {
      return {
        title: 'Stalemate',
        details: 'Draw by stalemate (no legal moves).',
        isOver: true,
        winner: 'draw',
      };
    }
    if (this.chess.isThreefoldRepetition()) {
      return {
        title: 'Threefold Repetition',
        details: 'Draw by threefold repetition.',
        isOver: true,
        winner: 'draw',
      };
    }
    if (this.chess.isInsufficientMaterial()) {
      return {
        title: 'Insufficient Material',
        details: 'Draw due to insufficient mating material.',
        isOver: true,
        winner: 'draw',
      };
    }
    if (this.chess.isDraw()) {
      return {
        title: 'Draw',
        details: 'Game drawn by 50-move rule or repetition.',
        isOver: true,
        winner: 'draw',
      };
    }
    if (this.chess.inCheck()) {
      return {
        title: 'Check',
        details: `${this.chess.turn() === 'w' ? 'White' : 'Black'} is in check!`,
        isOver: false,
      };
    }
    return {
      title: 'Active Game',
      details: `${this.chess.turn() === 'w' ? 'White' : 'Black'}'s turn to move`,
      isOver: false,
    };
  }
}
