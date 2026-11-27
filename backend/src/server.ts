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
const port = process.env.PORT || 4000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
}));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 30000,
  pingInterval: 10000,
});

const roomService = new RoomService();
const gameService = new GameService();
const rateLimiter = new RateLimiter(100, 60000);

// API Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'The Grand Chess Room Multiplayer API', timestamp: Date.now() });
});

// Periodic Clock Watchdog, Rate-Limiter Pruning & Expired Room Cleanup (every 1 second)
setInterval(() => {
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
  console.log(`[The Grand Chess Room] Server running at http://localhost:${port}`);
});

export { app, server, roomService, gameService };

