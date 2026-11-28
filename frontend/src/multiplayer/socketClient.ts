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
const URL_OVERRIDE_KEY = 'chessverse_socket_url_override';
const LOCAL_TIMEOUT_MS = 8000;
const REMOTE_TIMEOUT_MS = 25000;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface ResolvedServerConfig {
  url: string | null;
  shouldProbeSameOriginHealth: boolean;
  configError: string | null;
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

function isLoopbackUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return isLocalHostname(parsed.hostname) || parsed.hostname === '0.0.0.0';
  } catch {
    return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(rawUrl);
  }
}

function normalizeServerUrl(raw: string): string | null {
  const cleaned = raw.trim().replace(/\/+$/, '');
  if (!cleaned) return null;
  if (!/^https?:\/\//i.test(cleaned) && !/^wss?:\/\//i.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function resolveServerConfig(): ResolvedServerConfig {
  const runtimeOverride =
    typeof window !== 'undefined'
      ? normalizeServerUrl(
          new URLSearchParams(window.location.search).get('socketUrl') ||
            (typeof localStorage !== 'undefined' ? localStorage.getItem(URL_OVERRIDE_KEY) || '' : '')
        )
      : null;

  const envConfigured = normalizeServerUrl((import.meta.env.VITE_SOCKET_URL as string | undefined) || '');
  const candidate = runtimeOverride || envConfigured;

  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin } = window.location;
    const isRemoteHttpsPage = protocol === 'https:' && !isLocalHostname(hostname);

    if (isRemoteHttpsPage) {
      if (candidate && isLoopbackUrl(candidate)) {
        return {
          url: null,
          shouldProbeSameOriginHealth: false,
          configError:
            'Multiplayer backend URL in this production build points to localhost:4000. Deploy the backend server (Render/Railway/Fly) and set VITE_SOCKET_URL in Vercel to that https:// backend URL.',
        };
      }
      if (candidate) {
        if (candidate.startsWith('http://') && !isLocalHostname(new URL(candidate).hostname)) {
          return {
            url: candidate.replace(/^http:\/\//i, 'https://'),
            shouldProbeSameOriginHealth: false,
            configError: null,
          };
        }
        return { url: candidate, shouldProbeSameOriginHealth: false, configError: null };
      }
      // No VITE_SOCKET_URL set on HTTPS: only connect same-origin if /health proves a backend is actually running there
      return { url: origin, shouldProbeSameOriginHealth: true, configError: null };
    }

    if (candidate) {
      return { url: candidate, shouldProbeSameOriginHealth: false, configError: null };
    }
    if (hostname) {
      return { url: `http://${hostname}:4000`, shouldProbeSameOriginHealth: false, configError: null };
    }
  }

  return {
    url: candidate || 'http://localhost:4000',
    shouldProbeSameOriginHealth: false,
    configError: null,
  };
}

class SocketClient {
  private socket: Socket | null = null;
  private currentRoomCode: string | null = null;
  private currentRoomId: string | null = null;
  private currentPlayerId: string | null = null;
  private resolvedConfig: ResolvedServerConfig = resolveServerConfig();
  private serverUrl: string = this.resolvedConfig.url || '';
  private connectionStatus: ConnectionStatus = 'disconnected';
  private inflightLobbyAction: 'create' | 'join' | null = null;
  private sameOriginVerified: boolean | null = null;

  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  public getServerUrl(): string {
    return this.serverUrl;
  }

  private destroySocket() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectionStatus = 'disconnected';
  }

  private async ensureBackendReachableIfSameOrigin(): Promise<{ ok: boolean; error?: string }> {
    this.resolvedConfig = resolveServerConfig();
    if (this.resolvedConfig.configError) {
      return { ok: false, error: this.resolvedConfig.configError };
    }
    if (!this.resolvedConfig.url) {
      return {
        ok: false,
        error: 'Multiplayer backend URL is not configured (VITE_SOCKET_URL).',
      };
    }

    this.serverUrl = this.resolvedConfig.url;

    if (!this.resolvedConfig.shouldProbeSameOriginHealth || this.sameOriginVerified === true) {
      return { ok: true };
    }

    try {
      const httpBase = this.serverUrl.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${httpBase}/health`, { signal: controller.signal });
      window.clearTimeout(timeout);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const json = await res.json();
        if (json && json.status === 'ok') {
          this.sameOriginVerified = true;
          return { ok: true };
        }
      }
      this.sameOriginVerified = false;
      return {
        ok: false,
        error:
          'No persistent Socket.IO backend is running on this static Vercel domain. Deploy backend/ to a Node WebSocket host (Render/Railway/Fly) and set VITE_SOCKET_URL in Vercel.',
      };
    } catch {
      return {
        ok: false,
        error:
          'Unable to verify multiplayer backend service on this deployment. Check that the backend server is online and VITE_SOCKET_URL is set.',
      };
    }
  }

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

  public warmUp() {
    const cfg = resolveServerConfig();
    if (cfg.configError || !cfg.url || typeof fetch === 'undefined') return;
    if (cfg.shouldProbeSameOriginHealth || isLoopbackUrl(cfg.url)) return;
    const httpBase = cfg.url.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
    fetch(`${httpBase}/health`, { mode: 'cors' }).catch(() => {});
  }

  public connect(url?: string): Socket | null {
    if (url) {
      const normalized = normalizeServerUrl(url);
      if (normalized) {
        this.serverUrl = normalized;
        this.resolvedConfig = { url: normalized, shouldProbeSameOriginHealth: false, configError: null };
      }
    } else {
      this.resolvedConfig = resolveServerConfig();
      if (this.resolvedConfig.configError || !this.resolvedConfig.url) {
        this.connectionStatus = 'error';
        return null;
      }
      this.serverUrl = this.resolvedConfig.url;
    }

    if (!this.serverUrl) return null;

    const connectTimeoutMs = isLoopbackUrl(this.serverUrl) ? LOCAL_TIMEOUT_MS : REMOTE_TIMEOUT_MS;

    if (!this.socket) {
      this.connectionStatus = 'connecting';
      this.socket = io(this.serverUrl, {
        path: '/socket.io/',
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: connectTimeoutMs,
        transports: ['polling', 'websocket'],
        upgrade: true,
      });
      this.socket.on('connect', () => {
        this.connectionStatus = 'connected';
      });
      this.socket.on('disconnect', () => {
        this.connectionStatus = 'disconnected';
      });
      this.socket.on('connect_error', () => {
        this.connectionStatus = 'error';
      });
      this.socket.io.on('reconnect_failed', () => {
        this.connectionStatus = 'error';
      });
    } else if (!this.socket.connected) {
      this.connectionStatus = 'connecting';
      this.socket.connect();
    }

    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  private async emitWithConnection<T>(
    eventName: string,
    payload: unknown,
    onResult: (res: T & { success: boolean; error?: string }) => void
  ) {
    const preflight = await this.ensureBackendReachableIfSameOrigin();
    if (!preflight.ok) {
      this.connectionStatus = 'error';
      onResult({
        success: false,
        error: preflight.error || 'Multiplayer server URL is not configured cleanly.',
      } as T & { success: boolean; error?: string });
      return;
    }

    const s = this.connect();
    if (!s) {
      onResult({
        success: false,
        error:
          this.resolvedConfig.configError ||
          'Multiplayer server URL is not configured (VITE_SOCKET_URL missing or points to localhost).',
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
      if (res?.success === false && !s.connected) {
        this.destroySocket();
      }
      onResult(res);
    };

    const requestTimeoutMs = isLoopbackUrl(this.serverUrl) ? LOCAL_TIMEOUT_MS : REMOTE_TIMEOUT_MS;
    const timer = window.setTimeout(() => {
      this.connectionStatus = 'error';
      finish({
        success: false,
        error: 'Connection to multiplayer server timed out. Verify the backend server is online and try again.',
      });
    }, requestTimeoutMs);

    const onConnectErr = (err: Error) => {
      this.connectionStatus = 'error';
      const detail = err?.message || 'WebSocket connection failed';
      finish({
        success: false,
        error: `Unable to reach multiplayer server (${detail}).`,
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
    if (this.inflightLobbyAction === 'create') {
      onResult({ success: false, error: 'Room creation already in progress.' });
      return;
    }
    this.inflightLobbyAction = 'create';
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
        this.inflightLobbyAction = null;
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
    if (this.inflightLobbyAction === 'join') {
      onResult({ success: false, error: 'Already connecting to room...' });
      return;
    }
    this.inflightLobbyAction = 'join';
    this.emitWithConnection<{ room?: RoomData; player?: any }>(
      'room:join',
      { roomCode, playerName },
      (res) => {
        this.inflightLobbyAction = null;
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
    this.inflightLobbyAction = null;
    this.destroySocket();
  }
}

export const socketClient = new SocketClient();
