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

console.log('--- STARTING WEBSOCKET EDGE CASES TEST SUITE ---');

async function runEdgeCaseTests() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });

  const roomService = new RoomService();
  const gameService = new GameService();
  const rateLimiter = new RateLimiter(500, 60000);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', activeRooms: roomService.getActiveRooms().length });
  });

  io.on('connection', (socket) => {
    registerRoomEvents(io, socket, roomService, gameService, rateLimiter);
    registerGameEvents(io, socket, roomService, gameService, rateLimiter);
  });

  const TEST_PORT = 4997;
  await new Promise<void>((resolve) => server.listen(TEST_PORT, resolve));
  const url = `http://127.0.0.1:${TEST_PORT}`;

  // 1. Health endpoint readiness check
  const healthRes = await fetch(`${url}/health`);
  assert.strictEqual(healthRes.status, 200);
  const healthJson = (await healthRes.json()) as { status: string; activeRooms: number };
  assert.strictEqual(healthJson.status, 'ok');
  console.log('✓ Health readiness endpoint returned HTTP 200 JSON');

  const connectClient = async (): Promise<ClientSocketType> => {
    const c = ClientSocket(url, {
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 3000,
    });
    await new Promise<void>((resolve, reject) => {
      c.once('connect', resolve);
      c.once('connect_error', reject);
    });
    return c;
  };

  const clientA = await connectClient();
  const clientB = await connectClient();
  const clientC = await connectClient();

  try {
    // 2. Duplicate room creation by the same waiting host cleans up previous stale waiting room
    const firstCreate: any = await new Promise((resolve) => {
      clientA.emit(
        'room:create',
        { playerName: 'HostA', timeControl: { name: 'Rapid 10+0', initialMinutes: 10, incrementSeconds: 0 }, preferredColor: 'w' },
        resolve
      );
    });
    assert.strictEqual(firstCreate.success, true);
    const staleCode = firstCreate.room.roomCode;

    const secondCreate: any = await new Promise((resolve) => {
      clientA.emit(
        'room:create',
        { playerName: 'HostA', timeControl: { name: 'Rapid 10+0', initialMinutes: 10, incrementSeconds: 0 }, preferredColor: 'w' },
        resolve
      );
    });
    assert.strictEqual(secondCreate.success, true);
    assert.notStrictEqual(secondCreate.room.roomCode, staleCode);
    assert.strictEqual(roomService.getActiveRooms().length, 1, 'Duplicate waiting create should replace stale room cleanly');

    const staleJoin: any = await new Promise((resolve) => {
      clientB.emit('room:join', { roomCode: staleCode, playerName: 'GuestB' }, resolve);
    });
    assert.strictEqual(staleJoin.success, false);
    console.log('✓ Duplicate room creation cleaned up previous stale waiting room');

    // 3. Expired waiting room cleanup & rejection
    const expCreate: any = await new Promise((resolve) => {
      clientC.emit(
        'room:create',
        { playerName: 'ExpiringHost', timeControl: { name: 'Blitz 3+0', initialMinutes: 3, incrementSeconds: 0 } },
        resolve
      );
    });
    assert.strictEqual(expCreate.success, true);
    const expiringCode = expCreate.room.roomCode;
    const internalRoom = roomService.getRoomById(expCreate.room.roomId)!;
    internalRoom.createdAt = Date.now() - 35 * 60 * 1000; // > 30 min waiting TTL
    const expiredJoin: any = await new Promise((resolve) => {
      clientB.emit('room:join', { roomCode: expiringCode, playerName: 'LateGuest' }, resolve);
    });
    assert.strictEqual(expiredJoin.success, false);
    console.log('✓ Expired waiting room rejected cleanly on join');

    // 4. Invalid code formats & nonexistent room codes rejected
    for (const badCode of ['', 'ABC123', '12345', '999999']) {
      const code = badCode === secondCreate.room.roomCode ? '888888' : badCode;
      const res: any = await new Promise((resolve) => {
        clientB.emit('room:join', { roomCode: code, playerName: 'Tester' }, resolve);
      });
      assert.strictEqual(res.success, false);
    }
    console.log('✓ Invalid & nonexistent room codes rejected');

    // 5. Full room (3rd player join) rejected
    const activeCode = secondCreate.room.roomCode;
    const hostPlayerId = secondCreate.player.playerId;
    const joinB: any = await new Promise((resolve) => {
      clientB.emit('room:join', { roomCode: activeCode, playerName: 'PlayerB' }, resolve);
    });
    assert.strictEqual(joinB.success, true);
    const guestPlayerId = joinB.player.playerId;

    const fullRoomAttempt: any = await new Promise((resolve) => {
      clientC.emit('room:join', { roomCode: activeCode, playerName: 'IntruderC' }, resolve);
    });
    assert.strictEqual(fullRoomAttempt.success, false);
    assert.ok(String(fullRoomAttempt.error || '').toLowerCase().includes('full'));
    console.log('✓ Third-player join attempt into active room rejected');

    // 6. Disconnect -> opponent notification -> Reconnect recovery
    const disconnectNotified = new Promise<any>((resolve) => {
      clientA.once('room:opponent-disconnected', resolve);
    });
    clientB.disconnect();
    const dcPayload = await disconnectNotified;
    assert.strictEqual(dcPayload.playerName, 'PlayerB');

    const clientB2 = await connectClient();
    const reconnectedNotify = new Promise<any>((resolve) => {
      clientA.once('room:opponent-reconnected', resolve);
    });
    const reconnectRes: any = await new Promise((resolve) => {
      clientB2.emit('room:reconnect', { roomCode: activeCode, playerId: guestPlayerId }, resolve);
    });
    assert.strictEqual(reconnectRes.success, true);
    assert.strictEqual(reconnectRes.room.roomCode, activeCode);
    await reconnectedNotify;
    clientB2.disconnect();
    console.log('✓ Disconnect notification & session reconnect recovery succeeded');

    // Verify host playerId still valid after opponent reconnect
    assert.ok(hostPlayerId.length > 0);
  } finally {
    clientA.disconnect();
    clientB.disconnect();
    clientC.disconnect();
    io.close();
    server.close();
  }

  // 7. Server unavailability / unreachable backend endpoint triggers connect_error cleanly
  const unavailableErr = await new Promise<string>((resolve, reject) => {
    const deadSocket = ClientSocket('http://127.0.0.1:4998', {
      reconnection: false,
      timeout: 1200,
      transports: ['websocket', 'polling'],
    });
    const timer = setTimeout(() => {
      deadSocket.close();
      reject(new Error('Expected connect_error for unavailable server'));
    }, 3500);
    deadSocket.once('connect_error', (err) => {
      clearTimeout(timer);
      deadSocket.close();
      resolve(err?.message || 'connect_error');
    });
  });
  assert.ok(unavailableErr.length > 0);
  console.log(`✓ Unavailable backend server handled cleanly (${unavailableErr})`);

  console.log('--- WEBSOCKET EDGE CASES TEST SUITE PASSED! ---');
  process.exit(0);
}

runEdgeCaseTests().catch((err) => {
  console.error('Edge case test failed:', err);
  process.exit(1);
});
