import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { RoomService } from './services/roomService.js';
import { GameService } from './services/gameService.js';
import { ClockService } from './services/clockService.js';
import { RateLimiter } from './security/rateLimiter.js';
import { registerRoomEvents } from './socket/roomEvents.js';
import { registerGameEvents } from './socket/gameEvents.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

const VERCEL_PROJECT_ORIGIN_RE = /^https:\/\/chessverse3d(?:-[a-z0-9-]+)?\.vercel\.app$/i;

function parseCorsOrigins(raw: string | undefined): string[] | '*' {
  const val = (raw || '*').trim();
  if (!val || val === '*') return '*';
  const origins = val
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return origins.length === 0 ? '*' : origins;
}

const allowedCorsList = parseCorsOrigins(process.env.CORS_ORIGIN);

const corsOriginValidator = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  if (!origin) {
    callback(null, true);
    return;
  }
  if (allowedCorsList === '*') {
    callback(null, true);
    return;
  }
  const normalized = origin.trim().replace(/\/+$/, '');
  if (allowedCorsList.includes(normalized) || VERCEL_PROJECT_ORIGIN_RE.test(normalized)) {
    callback(null, true);
    return;
  }
  callback(new Error(`Origin ${normalized} not allowed by CORS`));
};

app.use(
  cors({
    origin: corsOriginValidator,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: allowedCorsList !== '*',
  })
);
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: corsOriginValidator,
    methods: ['GET', 'POST'],
    credentials: allowedCorsList !== '*',
  },
  transports: ['polling', 'websocket'],
  allowUpgrades: true,
  perMessageDeflate: false,
  httpCompression: true,
  pingTimeout: 30000,
  pingInterval: 10000,
});

const roomService = new RoomService();
const gameService = new GameService();
const rateLimiter = new RateLimiter(100, 60000);

// Readiness & API Health Check
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ChessVerse 3D Multiplayer Server',
    websocket: '/socket.io/',
    timestamp: Date.now(),
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'The Grand Chess Room Multiplayer API',
    activeRooms: roomService.getActiveRooms().length,
    uptimeSec: Math.round(process.uptime()),
    timestamp: Date.now(),
  });
});

// Periodic Clock Watchdog, Rate-Limiter Pruning & Expired Room Cleanup (every 1 second)
const watchdogTimer = setInterval(() => {
  rateLimiter.cleanup();
  roomService.cleanupExpiredRooms((removedRoomId) => {
    gameService.removeGame(removedRoomId);
  });

  for (const room of roomService.getActiveRooms()) {
    if ((room.status === 'active' || room.status === 'check') && room.clock.isRunning) {
      const times = ClockService.getUpdatedTimes(room.clock);
      if (times.hasTimedOut && times.timeoutColor) {
        const res = roomService.timeoutGame(room.roomId, times.timeoutColor);
        if (res.success && res.room) {
          io.to(room.roomId).emit('game:finished', {
            reason: 'timeout',
            winner: res.room.winner,
            status: 'timeout',
            room: res.room,
          });
        }
      }
    }
  }
}, 1000);

io.on('connection', (socket) => {
  registerRoomEvents(io, socket, roomService, gameService, rateLimiter);
  registerGameEvents(io, socket, roomService, gameService, rateLimiter);
});

server.listen(port, host, () => {
  console.log(`[The Grand Chess Room] Server listening on http://${host}:${port}`);
});

const shutdownGracefully = () => {
  clearInterval(watchdogTimer);
  io.close(() => {
    server.close(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 2500).unref();
};

process.on('SIGTERM', shutdownGracefully);
process.on('SIGINT', shutdownGracefully);

export { app, server, roomService, gameService };

