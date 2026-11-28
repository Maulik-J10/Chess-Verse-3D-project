import { io, Socket } from 'socket.io-client';
import { PieceColor, TimeControlPreset } from '../chess/types';

export interface RoomData {
  roomId: string;
  roomCode: string;
  creatorId: string;
  timeControl: {
    name?: string;
    initialMinutes: number;
    incrementSeconds: number;
  };
  players: {
    white?: { socketId: string; playerId: string; name: string; color: 'w'; connected: boolean };
    black?: { socketId: string; playerId: string; name: string; color: 'b'; connected: boolean };
  };
  fen: string;
  history?: any[];
  status: string;
  winner?: PieceColor | 'draw';
  clock: {
    whiteTimeMs: number;
    blackTimeMs: number;
    activeColor: PieceColor;
    isRunning: boolean;
  };
}

const SESSION_KEY = 'chessverse_mp_session';
const REQUEST_TIMEOUT_MS = 8000;

function resolveServerUrl(): string {
  const configured = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.trim();
  if (configured) return configured;

  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin } = window.location;
    if (protocol === 'https:') {
      return origin;
    }
    if (hostname) {
      return `http://${hostname}:4000`;
    }
  }
  return 'http://localhost:4000';
}

class SocketClient {
  private socket: Socket | null = null;
  private currentRoomCode: string | null = null;
  private currentRoomId: string | null = null;
  private currentPlayerId: string | null = null;
  private serverUrl: string = resolveServerUrl();

  private persistSession() {
    if (typeof sessionStorage === 'undefined') return;
    if (this.currentRoomCode && this.currentRoomId && this.currentPlayerId) {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          roomCode: this.currentRoomCode,
          roomId: this.currentRoomId,
          playerId: this.currentPlayerId,
        })
      );
    }
  }

  public clearSession() {
    this.currentRoomCode = null;
    this.currentRoomId = null;
    this.currentPlayerId = null;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  public getSavedSession(): { roomCode: string; roomId: string; playerId: string } | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public connect(url?: string): Socket | null {
    if (url) this.serverUrl = url.trim();
    if (!this.serverUrl) return null;

    if (!this.socket) {
      this.socket = io(this.serverUrl, {
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: REQUEST_TIMEOUT_MS,
        transports: ['websocket', 'polling'],
      });
    } else if (!this.socket.connected) {
      this.socket.connect();
    }

    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  private emitWithConnection<T>(
    eventName: string,
    payload: unknown,
    onResult: (res: T & { success: boolean; error?: string }) => void
  ) {
    const s = this.connect();
    if (!s) {
      onResult({
        success: false,
        error: 'Multiplayer server URL is not configured (VITE_SOCKET_URL missing for HTTPS deployment).',
      } as T & { success: boolean; error?: string });
      return;
    }

    let settled = false;
    const finish = (res: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      s.off('connect', sendEmit);
      s.off('connect_error', onConnectErr);
      onResult(res);
    };

    const timer = window.setTimeout(() => {
      finish({
        success: false,
        error: 'Connection to multiplayer server timed out. Verify the backend server is running and try again.',
      });
    }, REQUEST_TIMEOUT_MS);

    const onConnectErr = (err: Error) => {
      finish({
        success: false,
        error: `Unable to reach multiplayer server (${err?.message || 'connection failed'}).`,
      });
    };

    const sendEmit = () => {
      if (settled) return;
      s.emit(eventName, payload, (res: any) => {
        finish(res || { success: false, error: 'Invalid server response' });
      });
    };

    if (s.connected) {
      sendEmit();
    } else {
      s.once('connect', sendEmit);
      s.once('connect_error', onConnectErr);
    }
  }

  public createRoom(
    playerName: string,
    timeControl: TimeControlPreset,
    preferredColor: 'w' | 'b' | 'random',
    onResult: (data: { success: boolean; room?: RoomData; player?: any; error?: string }) => void
  ) {
    this.emitWithConnection<{ room?: RoomData; player?: any }>(
      'room:create',
      {
        playerName,
        timeControl: {
          name: timeControl.name,
          initialMinutes: timeControl.minutes,
          incrementSeconds: timeControl.increment,
        },
        preferredColor,
      },
      (res) => {
        if (res && res.success && res.room && res.player) {
          this.currentRoomCode = res.room.roomCode;
          this.currentRoomId = res.room.roomId;
          this.currentPlayerId = res.player.playerId;
          this.persistSession();
        }
        onResult(res);
      }
    );
  }

  public joinRoom(
    roomCode: string,
    playerName: string,
    onResult: (data: { success: boolean; room?: RoomData; player?: any; error?: string }) => void
  ) {
    this.emitWithConnection<{ room?: RoomData; player?: any }>(
      'room:join',
      { roomCode, playerName },
      (res) => {
        if (res && res.success && res.room && res.player) {
          this.currentRoomCode = res.room.roomCode;
          this.currentRoomId = res.room.roomId;
          this.currentPlayerId = res.player.playerId;
          this.persistSession();
        }
        onResult(res);
      }
    );
  }

  public reconnectRoom(
    onResult: (data: { success: boolean; room?: RoomData; player?: any; error?: string }) => void
  ) {
    const saved = this.getSavedSession();
    const roomId = this.currentRoomId || saved?.roomId;
    const roomCode = this.currentRoomCode || saved?.roomCode;
    const playerId = this.currentPlayerId || saved?.playerId;
    if (!roomId || !playerId) {
      onResult({ success: false, error: 'No active session' });
      return;
    }

    this.emitWithConnection<{ room?: RoomData; player?: any }>(
      'room:reconnect',
      { roomId, roomCode, playerId },
      (res) => {
        if (res && res.success && res.room && res.player) {
          this.currentRoomCode = res.room.roomCode;
          this.currentRoomId = res.room.roomId;
          this.currentPlayerId = res.player.playerId;
          this.persistSession();
        }
        onResult(res);
      }
    );
  }

  public sendMove(from: string, to: string, promotion?: string, onResult?: (res: any) => void) {
    if (!this.socket || !this.currentRoomCode || !this.currentPlayerId) {
      if (onResult) onResult({ success: false, error: 'Not connected to room' });
      return;
    }

    this.socket.emit(
      'game:move',
      {
        roomCode: this.currentRoomCode,
        playerId: this.currentPlayerId,
        from,
        to,
        promotion,
      },
      onResult
    );
  }

  public resign() {
    if (!this.socket || !this.currentRoomCode || !this.currentPlayerId) return;
    this.socket.emit('game:resign', {
      roomCode: this.currentRoomCode,
      playerId: this.currentPlayerId,
    });
  }

  public offerDraw() {
    if (!this.socket || !this.currentRoomCode || !this.currentPlayerId) return;
    this.socket.emit('game:offer-draw', {
      roomCode: this.currentRoomCode,
      playerId: this.currentPlayerId,
    });
  }

  public acceptDraw() {
    if (!this.socket || !this.currentRoomCode || !this.currentPlayerId) return;
    this.socket.emit('game:accept-draw', {
      roomCode: this.currentRoomCode,
      playerId: this.currentPlayerId,
    });
  }

  public rejectDraw() {
    if (!this.socket || !this.currentRoomCode || !this.currentPlayerId) return;
    this.socket.emit('game:reject-draw', {
      roomCode: this.currentRoomCode,
      playerId: this.currentPlayerId,
    });
  }

  public requestRematch(onResult?: (res: any) => void) {
    if (!this.socket || !this.currentRoomCode || !this.currentPlayerId) {
      if (onResult) onResult({ success: false, error: 'Not connected to room' });
      return;
    }
    this.socket.emit(
      'game:rematch',
      {
        roomCode: this.currentRoomCode,
        playerId: this.currentPlayerId,
      },
      onResult
    );
  }

  public leaveRoom() {
    if (this.socket && this.socket.connected) {
      this.socket.emit('room:leave');
    }
    this.clearSession();
  }

  public getSessionInfo() {
    return {
      roomCode: this.currentRoomCode,
      roomId: this.currentRoomId,
      playerId: this.currentPlayerId,
    };
  }

  public disconnect() {
    this.leaveRoom();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketClient = new SocketClient();
