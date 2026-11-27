import { Chess } from 'chess.js';
import {
  PieceColor,
  PlayerSession,
  RoomCreatePayload,
  RoomJoinPayload,
  RoomState,
} from '../types/index.js';
import { SessionValidator } from '../security/sessionValidator.js';
import { ClockService } from './clockService.js';

const WAITING_ROOM_TTL_MS = 30 * 60 * 1000;
const FINISHED_ROOM_TTL_MS = 15 * 60 * 1000;
const ABANDONED_ACTIVE_TTL_MS = 5 * 60 * 1000;

export class RoomService {
  private rooms: Map<string, RoomState> = new Map();
  private codeToRoomId: Map<string, string> = new Map();
  private socketToPlayer: Map<string, { roomId: string; playerId: string }> = new Map();
  private concludedAtMap: Map<string, number> = new Map();

  private isRoomExpired(room: RoomState, now: number): boolean {
    if (room.status === 'waiting') {
      return now - room.createdAt > WAITING_ROOM_TTL_MS;
    }
    if (room.status !== 'active' && room.status !== 'check') {
      const doneAt = this.concludedAtMap.get(room.roomId) || room.createdAt;
      return now - doneAt > FINISHED_ROOM_TTL_MS;
    }
    const white = room.players.white;
    const black = room.players.black;
    const bothDisconnected =
      (!white || (!white.connected && white.disconnectedAt)) &&
      (!black || (!black.connected && black.disconnectedAt));
    if (bothDisconnected) {
      const oldestDisconnect = Math.max(white?.disconnectedAt || 0, black?.disconnectedAt || 0);
      return oldestDisconnect > 0 && now - oldestDisconnect > ABANDONED_ACTIVE_TTL_MS;
    }
    return false;
  }

  private removeRoomInternal(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    this.codeToRoomId.delete(room.roomCode);
    if (room.players.white) this.socketToPlayer.delete(room.players.white.socketId);
    if (room.players.black) this.socketToPlayer.delete(room.players.black.socketId);
    this.rooms.delete(roomId);
    this.concludedAtMap.delete(roomId);
  }

  public cleanupExpiredRooms(onRemoved?: (roomId: string) => void): string[] {
    const now = Date.now();
    const removed: string[] = [];
    for (const [roomId, room] of this.rooms.entries()) {
      if (this.isRoomExpired(room, now)) {
        this.removeRoomInternal(roomId);
        removed.push(roomId);
        if (onRemoved) onRemoved(roomId);
      }
    }
    return removed;
  }

  public getActiveRooms(): RoomState[] {
    return Array.from(this.rooms.values());
  }

  public markRoomConcluded(roomId: string): void {
    if (!this.concludedAtMap.has(roomId)) {
      this.concludedAtMap.set(roomId, Date.now());
    }
  }

  public createRoom(
    socketId: string,
    payload: RoomCreatePayload,
    onCleanupStaleRoom?: (roomId: string) => void
  ): { room: RoomState; player: PlayerSession } {
    // Clean up any stale waiting room previously hosted by this exact socket
    const prevSession = this.socketToPlayer.get(socketId);
    if (prevSession) {
      const prevRoom = this.rooms.get(prevSession.roomId);
      if (prevRoom && prevRoom.status === 'waiting') {
        this.removeRoomInternal(prevRoom.roomId);
        if (onCleanupStaleRoom) onCleanupStaleRoom(prevRoom.roomId);
      } else {
        this.socketToPlayer.delete(socketId);
      }
    }

    const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    // Allocate unique 6-digit numeric code among active rooms (retry safely on collision)
    let roomCode = '';
    let allocated = false;
    for (let attempt = 0; attempt < 250; attempt++) {
      const candidate = SessionValidator.generateRoomCode();
      const existingId = this.codeToRoomId.get(candidate);
      if (existingId) {
        const existingRoom = this.rooms.get(existingId);
        if (existingRoom && this.isRoomExpired(existingRoom, Date.now())) {
          this.removeRoomInternal(existingId);
          if (onCleanupStaleRoom) onCleanupStaleRoom(existingId);
        }
      }
      if (!this.codeToRoomId.has(candidate)) {
        roomCode = candidate;
        allocated = true;
        break;
      }
    }
    if (!allocated) {
      throw new Error('Unable to allocate a unique 6-digit room code. Please try again.');
    }

    const playerId = SessionValidator.generatePlayerId();
    const cleanName = SessionValidator.sanitizeString(payload?.playerName) || 'Player 1';

    let creatorColor: PieceColor = 'w';
    if (payload?.preferredColor === 'b') {
      creatorColor = 'b';
    } else if (payload?.preferredColor === 'random') {
      creatorColor = Math.random() < 0.5 ? 'w' : 'b';
    }

    const rawMinutes = Number(payload?.timeControl?.initialMinutes);
    const rawIncrement = Number(payload?.timeControl?.incrementSeconds);
    const initialMinutes = Number.isFinite(rawMinutes) && rawMinutes >= 0 && rawMinutes <= 180 ? rawMinutes : 10;
    const incrementSeconds = Number.isFinite(rawIncrement) && rawIncrement >= 0 && rawIncrement <= 120 ? rawIncrement : 0;
    const tcName = SessionValidator.sanitizeString(payload?.timeControl?.name || 'Rapid 10+0', 28) || 'Rapid 10+0';

    const creatorSession: PlayerSession = {
      socketId,
      playerId,
      name: cleanName,
      color: creatorColor,
      connected: true,
    };

    const initialFen = new Chess().fen();
    const clock = ClockService.initClock(initialMinutes, incrementSeconds);

    const room: RoomState = {
      roomId,
      roomCode,
      createdAt: Date.now(),
      creatorId: playerId,
      timeControl: {
        name: tcName,
        initialMinutes,
        incrementSeconds,
      },
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

    // Reserve code and room synchronously to guarantee collision-free uniqueness
    this.rooms.set(roomId, room);
    this.codeToRoomId.set(roomCode, roomId);
    this.socketToPlayer.set(socketId, { roomId, playerId });

    return { room, player: creatorSession };
  }

  public joinRoom(
    socketId: string,
    payload: RoomJoinPayload,
    onCleanupExpired?: (roomId: string) => void
  ): { success: boolean; error?: string; room?: RoomState; player?: PlayerSession } {
    const code = SessionValidator.normalizeRoomCode(payload?.roomCode);
    if (!SessionValidator.isValidRoomCode(code)) {
      return { success: false, error: 'Please enter a valid 6-digit numeric room code.' };
    }

    const roomId = this.codeToRoomId.get(code);
    if (!roomId) {
      return { success: false, error: `Room not found for code ${code}. Verify the 6-digit code and try again.` };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.codeToRoomId.delete(code);
      return { success: false, error: 'Room not found or has already closed.' };
    }

    if (this.isRoomExpired(room, Date.now())) {
      this.removeRoomInternal(roomId);
      if (onCleanupExpired) onCleanupExpired(roomId);
      return { success: false, error: `Room ${code} has expired. Ask your friend to create a new room.` };
    }

    if (room.players.white?.socketId === socketId || room.players.black?.socketId === socketId) {
      return { success: false, error: 'You are already connected to this room.' };
    }

    if (room.status !== 'waiting' && room.status !== 'active') {
      return { success: false, error: 'This match has already concluded.' };
    }

    let playerColor: PieceColor;
    if (!room.players.white) {
      playerColor = 'w';
    } else if (!room.players.black) {
      playerColor = 'b';
    } else {
      return { success: false, error: 'This room is already full (2 players joined).' };
    }

    const playerId = SessionValidator.generatePlayerId();
    const cleanName = SessionValidator.sanitizeString(payload?.playerName) || 'Player 2';

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

    room.status = 'active';
    if (room.timeControl.initialMinutes > 0) {
      ClockService.startTurn(room.clock, 'w');
    } else {
      room.clock.activeColor = 'w';
      room.clock.isRunning = false;
    }

    this.socketToPlayer.set(socketId, { roomId, playerId });

    return {
      success: true,
      room,
      player: playerSession,
    };
  }

  public leaveRoom(socketId: string): { removedRoomId?: string; room?: RoomState; player?: PlayerSession } {
    const info = this.socketToPlayer.get(socketId);
    if (!info) return {};
    const room = this.rooms.get(info.roomId);
    if (!room) {
      this.socketToPlayer.delete(socketId);
      return {};
    }

    const player =
      room.players.white?.playerId === info.playerId
        ? room.players.white
        : room.players.black?.playerId === info.playerId
          ? room.players.black
          : undefined;

    if (room.status === 'waiting') {
      this.removeRoomInternal(room.roomId);
      return { removedRoomId: room.roomId, player };
    }

    if (player) {
      player.connected = false;
      player.disconnectedAt = Date.now();
    }
    this.socketToPlayer.delete(socketId);
    return { room, player };
  }

  public getRoomByCode(code: string): RoomState | undefined {
    const clean = SessionValidator.normalizeRoomCode(code);
    if (!clean) return undefined;
    const id = this.codeToRoomId.get(clean);
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

    const player =
      room.players.white?.playerId === info.playerId
        ? room.players.white
        : room.players.black?.playerId === info.playerId
          ? room.players.black
          : undefined;

    return { room, player };
  }

  public reconnectPlayer(
    socketId: string,
    roomIdOrCode: string,
    playerId: string
  ): { success: boolean; error?: string; room?: RoomState; player?: PlayerSession } {
    const room =
      this.rooms.get(roomIdOrCode) ||
      this.getRoomByCode(roomIdOrCode);
    if (!room) return { success: false, error: 'Room not found or expired' };

    let player: PlayerSession | undefined;
    if (room.players.white?.playerId === playerId) {
      player = room.players.white;
    } else if (room.players.black?.playerId === playerId) {
      player = room.players.black;
    }

    if (!player) return { success: false, error: 'Unauthorized session' };

    this.socketToPlayer.delete(player.socketId);
    player.socketId = socketId;
    player.connected = true;
    player.disconnectedAt = undefined;
    this.socketToPlayer.set(socketId, { roomId: room.roomId, playerId });

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
    if (!room || (room.status !== 'active' && room.status !== 'check')) return { success: false };

    room.status = 'resigned';
    room.winner = resigningColor === 'w' ? 'b' : 'w';
    ClockService.stopClock(room.clock);
    this.markRoomConcluded(roomId);

    return { success: true, room };
  }

  public offerDraw(roomId: string, fromColor: PieceColor): { success: boolean; room?: RoomState } {
    const room = this.rooms.get(roomId);
    if (!room || (room.status !== 'active' && room.status !== 'check')) return { success: false };

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
      this.markRoomConcluded(roomId);
    }
    room.drawOfferFrom = null;

    return { success: true, room };
  }

  public timeoutGame(roomId: string, timedOutColor: PieceColor): { success: boolean; room?: RoomState } {
    const room = this.rooms.get(roomId);
    if (!room || (room.status !== 'active' && room.status !== 'check')) return { success: false };

    room.status = 'timeout';
    room.winner = timedOutColor === 'w' ? 'b' : 'w';
    ClockService.stopClock(room.clock);
    this.markRoomConcluded(roomId);

    return { success: true, room };
  }
}
