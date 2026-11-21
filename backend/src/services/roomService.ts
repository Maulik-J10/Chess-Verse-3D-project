import { Chess } from 'chess.js';
import { 
  GameStatus, 
  PieceColor, 
  PlayerSession, 
  RoomCreatePayload, 
  RoomJoinPayload, 
  RoomState, 
  TimeControl 
} from '../types/index.js';
import { SessionValidator } from '../security/sessionValidator.js';
import { ClockService } from './clockService.js';

export class RoomService {
  private rooms: Map<string, RoomState> = new Map();
  private codeToRoomId: Map<string, string> = new Map();
  private socketToPlayer: Map<string, { roomId: string; playerId: string }> = new Map();

  public createRoom(socketId: string, payload: RoomCreatePayload): { room: RoomState; player: PlayerSession } {
    const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    
    // Generate unique room code
    let roomCode = SessionValidator.generateRoomCode();
    let attempts = 0;
    while (this.codeToRoomId.has(roomCode) && attempts < 20) {
      roomCode = SessionValidator.generateRoomCode();
      attempts++;
    }

    const playerId = SessionValidator.generatePlayerId();
    const cleanName = SessionValidator.sanitizeString(payload.playerName) || 'Player 1';

    let creatorColor: PieceColor = 'w';
    if (payload.preferredColor === 'b') {
      creatorColor = 'b';
    } else if (payload.preferredColor === 'random') {
      creatorColor = Math.random() < 0.5 ? 'w' : 'b';
    }

    const creatorSession: PlayerSession = {
      socketId,
      playerId,
      name: cleanName,
      color: creatorColor,
      connected: true,
    };

    const initialFen = new Chess().fen();
    const clock = ClockService.initClock(
      payload.timeControl.initialMinutes,
      payload.timeControl.incrementSeconds
    );

    const room: RoomState = {
      roomId,
      roomCode,
      createdAt: Date.now(),
      creatorId: playerId,
      timeControl: payload.timeControl,
      players: {
        [creatorColor === 'w' ? 'white' : 'black']: creatorSession,
      },
      spectators: [],
      fen: initialFen,
      history: [],
      status: 'waiting',
      winner: undefined,
      drawOfferFrom: null,
      clock,
    };

    this.rooms.set(roomId, room);
    this.codeToRoomId.set(roomCode, roomId);
    this.socketToPlayer.set(socketId, { roomId, playerId });

    return { room, player: creatorSession };
  }

  public joinRoom(socketId: string, payload: RoomJoinPayload): { success: boolean; error?: string; room?: RoomState; player?: PlayerSession } {
    const code = (payload.roomCode || '').trim().toUpperCase();
    const roomId = this.codeToRoomId.get(code);

    if (!roomId) {
      return { success: false, error: 'Room not found with code ' + code };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room does not exist' };
    }

    if (room.status !== 'waiting' && room.status !== 'active') {
      return { success: false, error: 'This game has already concluded' };
    }

    // Determine slot
    let playerColor: PieceColor;
    if (!room.players.white) {
      playerColor = 'w';
    } else if (!room.players.black) {
      playerColor = 'b';
    } else {
      return { success: false, error: 'This room is already full (2 players joined)' };
    }

    const playerId = SessionValidator.generatePlayerId();
    const cleanName = SessionValidator.sanitizeString(payload.playerName) || 'Player 2';

    const playerSession: PlayerSession = {
      socketId,
      playerId,
      name: cleanName,
      color: playerColor,
      connected: true,
    };

    if (playerColor === 'w') {
      room.players.white = playerSession;
    } else {
      room.players.black = playerSession;
    }

    // Now both players have joined -> start game
    room.status = 'active';
    ClockService.startTurn(room.clock, 'w');

    this.socketToPlayer.set(socketId, { roomId, playerId });

    return {
      success: true,
      room,
      player: playerSession,
    };
  }

  public getRoomByCode(code: string): RoomState | undefined {
    const id = this.codeToRoomId.get(code.trim().toUpperCase());
    return id ? this.rooms.get(id) : undefined;
  }

  public getRoomById(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  public getPlayerBySocket(socketId: string): { room?: RoomState; player?: PlayerSession } {
    const info = this.socketToPlayer.get(socketId);
    if (!info) return {};
    const room = this.rooms.get(info.roomId);
    if (!room) return {};

    const player = room.players.white?.playerId === info.playerId 
      ? room.players.white 
      : room.players.black?.playerId === info.playerId 
        ? room.players.black 
        : undefined;

    return { room, player };
  }

  public reconnectPlayer(socketId: string, roomId: string, playerId: string): { success: boolean; room?: RoomState; player?: PlayerSession } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false };

    let player: PlayerSession | undefined;
    if (room.players.white?.playerId === playerId) {
      player = room.players.white;
    } else if (room.players.black?.playerId === playerId) {
      player = room.players.black;
    }

    if (!player) return { success: false };

    // Update socket
    this.socketToPlayer.delete(player.socketId);
    player.socketId = socketId;
    player.connected = true;
    player.disconnectedAt = undefined;
    this.socketToPlayer.set(socketId, { roomId, playerId });

    return { success: true, room, player };
  }

  public handleDisconnect(socketId: string): { room?: RoomState; player?: PlayerSession } {
    const { room, player } = this.getPlayerBySocket(socketId);
    if (room && player) {
      player.connected = false;
      player.disconnectedAt = Date.now();
    }
    return { room, player };
  }

  public resignGame(roomId: string, resigningColor: PieceColor): { success: boolean; room?: RoomState } {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'active') return { success: false };

    room.status = 'resigned';
    room.winner = resigningColor === 'w' ? 'b' : 'w';
    ClockService.stopClock(room.clock);

    return { success: true, room };
  }

  public offerDraw(roomId: string, fromColor: PieceColor): { success: boolean; room?: RoomState } {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'active') return { success: false };

    room.drawOfferFrom = fromColor;
    return { success: true, room };
  }

  public resolveDrawOffer(roomId: string, accepted: boolean): { success: boolean; room?: RoomState } {
    const room = this.rooms.get(roomId);
    if (!room || !room.drawOfferFrom) return { success: false };

    if (accepted) {
      room.status = 'draw-agreement';
      room.winner = 'draw';
      ClockService.stopClock(room.clock);
    }
    room.drawOfferFrom = null;

    return { success: true, room };
  }

  public timeoutGame(roomId: string, timedOutColor: PieceColor): { success: boolean; room?: RoomState } {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'active') return { success: false };

    room.status = 'timeout';
    room.winner = timedOutColor === 'w' ? 'b' : 'w';
    ClockService.stopClock(room.clock);

    return { success: true, room };
  }
}

