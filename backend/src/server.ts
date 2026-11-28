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

function parseCorsOrigins(raw: string | undefined): string | string[] {
  const val = (raw || '*').trim();
  if (!val || val === '*') return '*';
  const origins = val
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return origins.length <= 1 ? (origins[0] || '*') : origins;
}

const allowedCorsOrigin = parseCorsOrigins(process.env.CORS_ORIGIN);

app.use(
  cors({
    origin: allowedCorsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: allowedCorsOrigin !== '*',
  })
);
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedCorsOrigin,
    methods: ['GET', 'POST'],
    credentials: allowedCorsOrigin !== '*',
  },
  transports: ['websocket', 'polling'],
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

server.listen(port, () => {
  console.log(`[The Grand Chess Room] Server running on port ${port}`);
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

