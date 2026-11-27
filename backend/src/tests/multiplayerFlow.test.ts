import assert from 'assert';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { RoomService } from '../services/roomService.js';
import { GameService } from '../services/gameService.js';
import { RateLimiter } from '../security/rateLimiter.js';
import { registerRoomEvents } from '../socket/roomEvents.js';
import { registerGameEvents } from '../socket/gameEvents.js';

console.log('--- STARTING MULTIPLAYER 1v1 LIVE SOCKET INTEGRATION TEST ---');

async function runMultiplayerTest() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  const roomService = new RoomService();
  const gameService = new GameService();
  const rateLimiter = new RateLimiter(500, 60000);

  io.on('connection', (socket) => {
    registerRoomEvents(io, socket, roomService, gameService, rateLimiter);
    registerGameEvents(io, socket, roomService, gameService, rateLimiter);
  });

  const TEST_PORT = 4999;
  await new Promise<void>((resolve) => server.listen(TEST_PORT, resolve));

  const url = `http://localhost:${TEST_PORT}`;

  const clientA: ClientSocketType = ClientSocket(url);
  const clientB: ClientSocketType = ClientSocket(url);

  await new Promise<void>((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    clientA.on('connect', check);
    clientB.on('connect', check);
  });

  console.log('✓ Both test clients connected to Socket.IO server');

  // 1. Client A creates a room
  let roomCode = '';
  let playerAId = '';
  await new Promise<void>((resolve) => {
    clientA.emit('room:create', {
      playerName: 'Player A',
      timeControl: { name: 'Rapid 10+0', initialMinutes: 10, incrementSeconds: 0 },
      preferredColor: 'w',
    }, (res: any) => {
      assert.strictEqual(res.success, true);
      assert(/^\d{6}$/.test(res.room.roomCode), `Expected 6-digit numeric code, got ${res.room.roomCode}`);
      assert.strictEqual(res.player.color, 'w');
      roomCode = res.room.roomCode;
      playerAId = res.player.playerId;
      console.log(`✓ Room created successfully with 6-digit code: ${roomCode}`);
      resolve();
    });
  });

  // 1b. Invalid room codes are authoritatively rejected
  await new Promise<void>((resolve) => {
    clientB.emit('room:join', { roomCode: '000000' === roomCode ? '000001' : '000000', playerName: 'Ghost' }, (res: any) => {
      assert.strictEqual(res.success, false);
      resolve();
    });
  });
  await new Promise<void>((resolve) => {
    clientB.emit('room:join', { roomCode: 'CHS123', playerName: 'Ghost' }, (res: any) => {
      assert.strictEqual(res.success, false);
      resolve();
    });
  });

  // 2. Client B joins using room code
  let playerBId = '';
  await new Promise<void>((resolve) => {
    clientB.emit('room:join', {
      roomCode,
      playerName: 'Player B',
    }, (res: any) => {
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.player.color, 'b');
      playerBId = res.player.playerId;
      console.log('✓ Player B joined successfully and assigned Black');
      resolve();
    });
  });

  // 3. Client A plays legal move (e2 -> e4)
  await new Promise<void>((resolve) => {
    // Both clients should receive game:move
    let receivedCount = 0;
    const onMove = (payload: any) => {
      assert.strictEqual(payload.move.san, 'e4');
      receivedCount++;
      if (receivedCount === 2) {
        console.log('✓ Legal move e4 synchronized to both players');
        clientA.off('game:move', onMove);
        clientB.off('game:move', onMove);
        resolve();
      }
    };
    clientA.on('game:move', onMove);
    clientB.on('game:move', onMove);

    clientA.emit('game:move', {
      roomCode,
      playerId: playerAId,
      from: 'e2',
      to: 'e4',
    });
  });

  // 4. Client A tries to move again out of turn (should be rejected)
  await new Promise<void>((resolve) => {
    clientA.emit('game:move', {
      roomCode,
      playerId: playerAId,
      from: 'e4',
      to: 'e5',
    }, (res: any) => {
      assert.strictEqual(res.success, false);
      console.log('✓ Out-of-turn move attempt authoritatively rejected by server');
      resolve();
    });
  });

  // 5. Client B makes legal move (e7 -> e5)
  await new Promise<void>((resolve) => {
    clientB.emit('game:move', {
      roomCode,
      playerId: playerBId,
      from: 'e7',
      to: 'e5',
    }, (res: any) => {
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.move.san, 'e5');
      console.log('✓ Legal move e5 by Player B accepted and synced');
      resolve();
    });
  });

  // Cleanup
  clientA.disconnect();
  clientB.disconnect();
  server.close();
  console.log('--- MULTIPLAYER 1v1 LIVE SOCKET INTEGRATION TEST PASSED! ---');
  process.exit(0);
}

runMultiplayerTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

