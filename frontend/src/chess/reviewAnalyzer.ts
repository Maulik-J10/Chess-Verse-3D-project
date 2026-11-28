import { Chess, Square } from 'chess.js';
import { MoveHistoryItem, PieceColor, PieceType } from './types';

export interface CheckmateReviewSummary {
  winner: PieceColor;
  loser: PieceColor;
  totalPlies: number;
  matingMoveIndex: number;
  matingSan: string;
  matingPieceName: string;
  matingFrom: string;
  matingTo: string;
  kingSquare: string;
  motif: string;
  summary: string;
  kingEscapeNote: string;
  decisiveMistakeIndex: number | null;
  decisiveMistakeSan: string | null;
  decisiveMistakeReason: string | null;
  betterMoveSan: string | null;
}

const PIECE_NAMES: Record<PieceType, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};

const PIECE_VALUES: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const STANDARD_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function oppositeColor(c: PieceColor): PieceColor {
  return c === 'w' ? 'b' : 'w';
}

function formatMoveLabel(plyIndex: number, san: string, color: PieceColor): string {
  const moveNumber = Math.floor(plyIndex / 2) + 1;
  return color === 'w' ? `${moveNumber}. ${san}` : `${moveNumber}...${san}`;
}

function getAdjacentSquares(square: string): Square[] {
  const fileIdx = square.charCodeAt(0) - 97;
  const rankIdx = parseInt(square[1], 10) - 1;
  const res: Square[] = [];
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const nf = fileIdx + df;
      const nr = rankIdx + dr;
      if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
        res.push(`${String.fromCharCode(97 + nf)}${nr + 1}` as Square);
      }
    }
  }
  return res;
}

function findKingSquare(chess: Chess, color: PieceColor): Square | null {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (piece && piece.type === 'k' && piece.color === color) {
        return piece.square;
      }
    }
  }
  return null;
}

function evaluateMaterialBalance(chess: Chess, perspective: PieceColor): number {
  const board = chess.board();
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p) continue;
      const v = PIECE_VALUES[p.type];
      score += p.color === perspective ? v : -v;
    }
  }
  return score;
}

function findMateInOne(fen: string): string | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  for (const m of moves) {
    // Only checks can be mate in 1
    if (!m.san.includes('+') && !m.san.includes('#')) continue;
    chess.move(m);
    const isMate = chess.isCheckmate();
    chess.undo();
    if (isMate) return m.san;
  }
  return null;
}

function rankAlternativeMove(chessBeforeMove: Chess, moveObj: any, defender: PieceColor): number {
  chessBeforeMove.move(moveObj);
  const mat = evaluateMaterialBalance(chessBeforeMove, defender);
  const opponentHasMateInOne = findMateInOne(chessBeforeMove.fen()) !== null;
  let immediateDrawOrCheck = 0;
  if (chessBeforeMove.isDraw()) immediateDrawOrCheck += 2;
  if (chessBeforeMove.inCheck()) immediateDrawOrCheck += 0.5;
  if (moveObj.captured) immediateDrawOrCheck += PIECE_VALUES[moveObj.captured as PieceType] * 0.4;
  chessBeforeMove.undo();

  return (opponentHasMateInOne ? -1000 : 0) + mat * 10 + immediateDrawOrCheck;
}

function findBestNonMateAlternative(
  fenBeforeMove: string,
  playedSan: string,
  defender: PieceColor,
): { bestSan: string; allLoseToMateInOne: boolean } | null {
  const chess = new Chess(fenBeforeMove);
  const moves = chess.moves({ verbose: true });
  let bestSan: string | null = null;
  let bestScore = -Infinity;
  let safeCount = 0;

  for (const m of moves) {
    if (m.san === playedSan) continue;
    chess.move(m);
    const leadsToMate1 = findMateInOne(chess.fen()) !== null;
    chess.undo();
    if (leadsToMate1) continue;

    safeCount++;
    const score = rankAlternativeMove(chess, m, defender);
    if (score > bestScore) {
      bestScore = score;
      bestSan = m.san;
    }
  }

  if (safeCount === 0 || !bestSan) {
    return { bestSan: '', allLoseToMateInOne: true };
  }
  return { bestSan, allLoseToMateInOne: false };
}

function detectCheckmateMotif(
  finalChess: Chess,
  matingMove: MoveHistoryItem,
  kingSq: Square,
  loser: PieceColor,
): { motif: string; escapeNote: string } {
  const adj = getAdjacentSquares(kingSq);
  const blockedByOwn: string[] = [];
  const controlledByWinner: string[] = [];

  const moverPiece = finalChess.get(matingMove.to as Square);
  const pieceType = moverPiece?.type ?? 'q';
  const pieceName = PIECE_NAMES[pieceType];

  for (const sq of adj) {
    const occupant = finalChess.get(sq);
    if (occupant && occupant.color === loser) {
      blockedByOwn.push(sq);
    } else {
      controlledByWinner.push(sq);
    }
  }

  const escapeParts: string[] = [];
  if (controlledByWinner.length > 0) {
    escapeParts.push(`attacker control covers ${controlledByWinner.join(', ')}`);
  }
  if (blockedByOwn.length > 0) {
    escapeParts.push(`friendly pieces obstruct ${blockedByOwn.join(', ')}`);
  }
  const escapeNote =
    escapeParts.length > 0
      ? `The ${loser === 'w' ? 'White' : 'Black'} King on ${kingSq} had no legal move because ${escapeParts.join(' and ')}.`
      : `All escape squares around ${kingSq} are covered and the checking line cannot be blocked or captured.`;

  if (pieceType === 'n' && controlledByWinner.length === 0 && blockedByOwn.length === adj.length) {
    return { motif: 'Smothered Mate', escapeNote };
  }

  const backRank = loser === 'w' ? '1' : '8';
  if (
    kingSq[1] === backRank &&
    (pieceType === 'r' || pieceType === 'q') &&
    blockedByOwn.length >= 2 &&
    blockedByOwn.every((sq) => {
      const p = finalChess.get(sq as Square);
      return p?.type === 'p' && sq[1] === (loser === 'w' ? '2' : '7');
    })
  ) {
    return { motif: 'Back-Rank Checkmate', escapeNote };
  }

  if (matingMove.san.includes('=')) {
    return { motif: 'Promotion Checkmate', escapeNote };
  }

  const distFile = Math.abs(matingMove.to.charCodeAt(0) - kingSq.charCodeAt(0));
  const distRank = Math.abs(parseInt(matingMove.to[1], 10) - parseInt(kingSq[1], 10));
  if (pieceType === 'q' && Math.max(distFile, distRank) === 1) {
    return { motif: 'Supported Queen Checkmate', escapeNote };
  }

  return { motif: `${pieceName} Checkmate`, escapeNote };
}

export function analyzeCheckmateGame(
  history: MoveHistoryItem[],
  winner: PieceColor,
): CheckmateReviewSummary | null {
  if (!history || history.length === 0) return null;

  const loser = oppositeColor(winner);
  const matingMoveIndex = history.length - 1;
  const matingMove = history[matingMoveIndex];

  let finalChess: Chess;
  try {
    finalChess = new Chess(matingMove.fen);
  } catch {
    return null;
  }

  if (!finalChess.isCheckmate()) {
    return null;
  }

  const kingSquare = findKingSquare(finalChess, loser);
  if (!kingSquare) return null;

  const moverPiece = finalChess.get(matingMove.to as Square);
  const matingPieceName = PIECE_NAMES[moverPiece?.type ?? 'q'];
  const { motif, escapeNote } = detectCheckmateMotif(finalChess, matingMove, kingSquare, loser);

  const winnerLabel = winner === 'w' ? 'White' : 'Black';
  const loserLabel = loser === 'w' ? 'White' : 'Black';
  const matingLabel = formatMoveLabel(matingMoveIndex, matingMove.san, matingMove.color);

  // Inspect only verified immediate blunder leading directly to mate-in-1, or large unforced material drop right beforehand
  let decisiveMistakeIndex: number | null = null;
  let decisiveMistakeSan: string | null = null;
  let decisiveMistakeReason: string | null = null;
  let betterMoveSan: string | null = null;

  const lastLoserIdx = matingMoveIndex - 1;
  if (lastLoserIdx >= 0 && history[lastLoserIdx].color === loser) {
    const fenBeforeLoserMove = lastLoserIdx > 0 ? history[lastLoserIdx - 1].fen : STANDARD_START_FEN;
    const loserMove = history[lastLoserIdx];
    try {
      const altCheck = findBestNonMateAlternative(fenBeforeLoserMove, loserMove.san, loser);
      if (altCheck && !altCheck.allLoseToMateInOne && altCheck.bestSan) {
        decisiveMistakeIndex = lastLoserIdx;
        decisiveMistakeSan = loserMove.san;
        betterMoveSan = altCheck.bestSan;
        const mistakeLabel = formatMoveLabel(lastLoserIdx, loserMove.san, loser);
        decisiveMistakeReason = `${mistakeLabel} left the ${loserLabel} King open to immediate mate (${matingLabel}). Playing ${altCheck.bestSan} instead avoided checkmate on the spot.`;
      }
    } catch {
      // Ignore malformed historical FEN edge cases cleanly
    }
  }

  // If immediate last move was already forced mate-in-1 regardless of reply, inspect one loser turn earlier for a severe blunder
  if (decisiveMistakeIndex === null) {
    const prevLoserIdx = matingMoveIndex - 3;
    if (prevLoserIdx >= 0 && history[prevLoserIdx].color === loser) {
      try {
        const fenBeforePrev = prevLoserIdx > 0 ? history[prevLoserIdx - 1].fen : STANDARD_START_FEN;
        const playedFen = history[prevLoserIdx].fen;
        const beforeChess = new Chess(fenBeforePrev);
        const afterChess = new Chess(playedFen);
        const drop = evaluateMaterialBalance(beforeChess, loser) - evaluateMaterialBalance(afterChess, loser);

        // Check whether winner created an immediate mate threat right on the follow-up or loser dropped major material
        const altPrev = findBestNonMateAlternative(fenBeforePrev, history[prevLoserIdx].san, loser);
        if (altPrev && !altPrev.allLoseToMateInOne && altPrev.bestSan && drop >= 3) {
          decisiveMistakeIndex = prevLoserIdx;
          decisiveMistakeSan = history[prevLoserIdx].san;
          betterMoveSan = altPrev.bestSan;
          const mistakeLabel = formatMoveLabel(prevLoserIdx, history[prevLoserIdx].san, loser);
          decisiveMistakeReason = `${mistakeLabel} conceded decisive material right before the final attack; ${altPrev.bestSan} kept better defensive stability.`;
        }
      } catch {
        // Safe fallback
      }
    }
  }

  const summary =
    `${winnerLabel} sealed the game with ${matingLabel} (${matingPieceName} from ${matingMove.from} to ${matingMove.to}), ` +
    `delivering ${motif.toLowerCase()} against the ${loserLabel} King on ${kingSquare}.`;

  return {
    winner,
    loser,
    totalPlies: history.length,
    matingMoveIndex,
    matingSan: matingMove.san,
    matingPieceName,
    matingFrom: matingMove.from,
    matingTo: matingMove.to,
    kingSquare,
    motif,
    summary,
    kingEscapeNote: escapeNote,
    decisiveMistakeIndex,
    decisiveMistakeSan,
    decisiveMistakeReason,
    betterMoveSan,
  };
}
