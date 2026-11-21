import { io, Socket } from 'socket.io-client';
import { PieceColor, TimeControlPreset } from '../chess/types';

export interface RoomData {
  roomId: string;
  roomCode: string;
  creatorId: string;
  timeControl: {
    initialMinutes: number;
    incrementSeconds: number;
  };
  players: {
    white?: { socketId: string; playerId: string; name: string; color: 'w'; connected: boolean };
    black?: { socketId: string; playerId: string; name: string; color: 'b'; connected: boolean };
  };
  fen: string;
  status: string;
  winner?: PieceColor | 'draw';
  clock: {
    whiteTimeMs: number;
    blackTimeMs: number;
    activeColor: PieceColor;
    isRunning: boolean;
  };
}

class SocketClient {
  private socket: Socket | null = null;
  private currentRoomCode: string | null = null;
  private currentPlayerId: string | null = null;
  private serverUrl: string = (import.meta.env.VITE_SOCKET_URL as string) || 'http://localhost:4000';

  public connect(url?: string): Socket {
    if (url) this.serverUrl = url;

    if (!this.socket) {
      this.socket = io(this.serverUrl, {
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected to server ID:', this.socket?.id);
      });

      this.socket.on('disconnect', (reason) => {
        console.warn('[Socket] Disconnected:', reason);
      });
    }

    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public createRoom(
    playerName: string,
    timeControl: TimeControlPreset,
    preferredColor: 'w' | 'b' | 'random',
    onResult: (data: { success: boolean; room?: RoomData; player?: any; error?: string }) => void
  ) {
    const s = this.connect();
    s.emit(
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
      (res: any) => {
        if (res && res.success && res.room && res.player) {
          this.currentRoomCode = res.room.roomCode;
          this.currentPlayerId = res.player.playerId;
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
    const s = this.connect();
    s.emit('room:join', { roomCode, playerName }, (res: any) => {
      if (res && res.success && res.room && res.player) {
        this.currentRoomCode = res.room.roomCode;
        this.currentPlayerId = res.player.playerId;
      }
      onResult(res);
    });
  }

  public sendMove(from: string, to: string, promotion?: string, onResult?: (res: any) => void) {
    if (!this.socket || !this.currentRoomCode || !this.currentPlayerId) return;

    this.socket.emit('game:move', {
      roomCode: this.currentRoomCode,
      playerId: this.currentPlayerId,
      from,
      to,
      promotion,
    }, onResult);
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

  public getSessionInfo() {
    return {
      roomCode: this.currentRoomCode,
      playerId: this.currentPlayerId,
    };
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketClient = new SocketClient();
