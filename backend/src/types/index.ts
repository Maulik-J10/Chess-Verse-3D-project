export type PieceColor = 'w' | 'b';

export type GameStatus = 
  | 'waiting'
  | 'active'
  | 'check'
  | 'checkmate'
  | 'stalemate'
  | 'draw-repetition'
  | 'draw-fifty-move'
  | 'draw-insufficient'
  | 'draw-agreement'
  | 'resigned'
  | 'timeout'
  | 'abandoned';

export interface PlayerSession {
  socketId: string;
  playerId: string;
  name: string;
  color: PieceColor;
  connected: boolean;
  disconnectedAt?: number;
}

export interface TimeControl {
  name: string;
  initialMinutes: number;
  incrementSeconds: number;
}

export interface GameClockState {
  whiteTimeMs: number;
  blackTimeMs: number;
  lastTurnStartTimeMs: number;
  incrementMs: number;
  activeColor: PieceColor;
  isRunning: boolean;
}

export interface MoveRecord {
  san: string;
  from: string;
  to: string;
  promotion?: string;
  fenBefore: string;
  fenAfter: string;
  timestamp: number;
  whiteTimeRemainingMs: number;
  blackTimeRemainingMs: number;
}

export interface RoomState {
  roomId: string;
  roomCode: string;
  createdAt: number;
  creatorId: string;
  timeControl: TimeControl;
  players: {
    white?: PlayerSession;
    black?: PlayerSession;
  };
  spectators: string[];
  fen: string;
  history: MoveRecord[];
  status: GameStatus;
  winner?: PieceColor | 'draw';
  drawOfferFrom?: PieceColor | null;
  clock: GameClockState;
}

export interface ClientMovePayload {
  roomCode: string;
  playerId: string;
  from: string;
  to: string;
  promotion?: string;
}

export interface RoomCreatePayload {
  playerName: string;
  timeControl: TimeControl;
  preferredColor?: 'w' | 'b' | 'random';
}

export interface RoomJoinPayload {
  roomCode: string;
  playerName: string;
}

