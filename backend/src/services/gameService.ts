import { Chess } from 'chess.js';
import { GameStatus, MoveRecord, PieceColor } from '../types/index.js';

export interface MoveValidationResult {
  valid: boolean;
  error?: string;
  san?: string;
  fen?: string;
  isCheck?: boolean;
  isCheckmate?: boolean;
  isStalemate?: boolean;
  isDraw?: boolean;
  drawReason?: string;
  gameStatus?: GameStatus;
  winner?: PieceColor | 'draw';
}

export class GameService {
  private games: Map<string, Chess> = new Map();

  public getOrCreateGame(roomId: string, initialFen?: string): Chess {
    let game = this.games.get(roomId);
    if (!game) {
      game = initialFen ? new Chess(initialFen) : new Chess();
      this.games.set(roomId, game);
    }
    return game;
  }

  public removeGame(roomId: string): void {
    this.games.delete(roomId);
  }

  public validateAndExecuteMove(
    roomId: string,
    expectedTurnColor: PieceColor,
    from: string,
    to: string,
    promotion?: string
  ): MoveValidationResult {
    const game = this.getOrCreateGame(roomId);

    // Check if it's the player's turn
    const currentTurn = game.turn() as PieceColor;
    if (currentTurn !== expectedTurnColor) {
      return {
        valid: false,
        error: `It is not ${expectedTurnColor === 'w' ? 'White' : 'Black'}'s turn`,
      };
    }

    try {
      const move = game.move({
        from,
        to,
        promotion: promotion ? promotion.toLowerCase() : undefined,
      });

      if (!move) {
        return {
          valid: false,
          error: 'Illegal move attempted',
        };
      }

      // Check game termination states
      let gameStatus: GameStatus = 'active';
      let winner: PieceColor | 'draw' | undefined = undefined;
      let drawReason: string | undefined = undefined;

      if (game.isCheckmate()) {
        gameStatus = 'checkmate';
        winner = expectedTurnColor; // The player who just moved delivered checkmate
      } else if (game.isStalemate()) {
        gameStatus = 'stalemate';
        winner = 'draw';
        drawReason = 'Stalemate - No legal moves available';
      } else if (game.isThreefoldRepetition()) {
        gameStatus = 'draw-repetition';
        winner = 'draw';
        drawReason = 'Threefold repetition of position';
      } else if (game.isInsufficientMaterial()) {
        gameStatus = 'draw-insufficient';
        winner = 'draw';
        drawReason = 'Insufficient material to checkmate';
      } else if (game.isDraw()) {
        gameStatus = 'draw-fifty-move';
        winner = 'draw';
        drawReason = 'Draw by 50-move rule';
      } else if (game.inCheck()) {
        gameStatus = 'check';
      }

      return {
        valid: true,
        san: move.san,
        fen: game.fen(),
        isCheck: game.inCheck(),
        isCheckmate: game.isCheckmate(),
        isStalemate: game.isStalemate(),
        isDraw: game.isDraw(),
        drawReason,
        gameStatus,
        winner,
      };
    } catch (err: any) {
      return {
        valid: false,
        error: err?.message || 'Move execution failed',
      };
    }
  }

  public getFen(roomId: string): string {
    const game = this.games.get(roomId);
    return game ? game.fen() : new Chess().fen();
  }

  public getTurn(roomId: string): PieceColor {
    const game = this.games.get(roomId);
    return (game ? game.turn() : 'w') as PieceColor;
  }
}

