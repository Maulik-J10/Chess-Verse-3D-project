import { Server, Socket } from 'socket.io';
import { RoomService } from '../services/roomService.js';
import { GameService } from '../services/gameService.js';
import { ClockService } from '../services/clockService.js';
import { RateLimiter } from '../security/rateLimiter.js';
import { RoomCreatePayload, RoomJoinPayload } from '../types/index.js';

export function registerRoomEvents(
  io: Server,
  socket: Socket,
  roomService: RoomService,
  gameService: GameService,
  rateLimiter: RateLimiter
) {
  // CREATE A ROOM
  socket.on('room:create', (payload: RoomCreatePayload, callback) => {
    if (!rateLimiter.isAllowed(socket.id)) {
      if (typeof callback === 'function') callback({ success: false, error: 'Too many requests. Please wait a moment.' });
      return;
    }

    try {
      const { room, player } = roomService.createRoom(socket.id, payload, (staleRoomId) => {
        gameService.removeGame(staleRoomId);
      });
      gameService.getOrCreateGame(room.roomId);

      socket.join(room.roomId);

      const response = {
        success: true,
        room,
        player,
      };

      socket.emit('room:created', response);
      if (typeof callback === 'function') callback(response);
    } catch (err: any) {
      const errRes = { success: false, error: err?.message || 'Failed to create room' };
      socket.emit('room:error', { message: errRes.error });
      if (typeof callback === 'function') callback(errRes);
    }
  });

  // JOIN A ROOM
  socket.on('room:join', (payload: RoomJoinPayload, callback) => {
    if (!rateLimiter.isAllowed(socket.id)) {
      if (typeof callback === 'function') callback({ success: false, error: 'Too many requests. Please wait a moment.' });
      return;
    }

    try {
      const result = roomService.joinRoom(socket.id, payload, (expiredRoomId) => {
        gameService.removeGame(expiredRoomId);
      });
      if (!result.success || !result.room || !result.player) {
        if (typeof callback === 'function') callback(result);
        socket.emit('room:error', { message: result.error });
        return;
      }

      socket.join(result.room.roomId);

      // Notify joining player
      socket.emit('room:joined', {
        success: true,
        room: result.room,
        player: result.player,
      });

      // Notify the creator / opponent waiting in the room
      socket.to(result.room.roomId).emit('room:opponent-connected', {
        opponent: result.player,
        room: result.room,
      });

      // Broadcast authoritative room state to both players
      io.to(result.room.roomId).emit('game:state', result.room);

      if (typeof callback === 'function') callback({ success: true, room: result.room, player: result.player });
    } catch (err: any) {
      const errRes = { success: false, error: err?.message || 'Failed to join room' };
      socket.emit('room:error', { message: errRes.error });
      if (typeof callback === 'function') callback(errRes);
    }
  });

  // LEAVE WAITING / ACTIVE ROOM EXPLICITLY
  socket.on('room:leave', (_payload: unknown, callback) => {
    const res = roomService.leaveRoom(socket.id);
    if (res.removedRoomId) {
      socket.leave(res.removedRoomId);
      gameService.removeGame(res.removedRoomId);
    } else if (res.room && res.player) {
      socket.leave(res.room.roomId);
      socket.to(res.room.roomId).emit('room:opponent-disconnected', {
        playerColor: res.player.color,
        playerName: res.player.name,
        gracePeriodSeconds: 60,
      });
    }
    if (typeof callback === 'function') callback({ success: true });
  });

  // RECONNECT TO EXISTING SESSION (supports roomId or roomCode)
  socket.on('room:reconnect', (payload: { roomId?: string; roomCode?: string; playerId: string }, callback) => {
    const key = payload?.roomId || payload?.roomCode || '';
    const result = roomService.reconnectPlayer(socket.id, key, payload?.playerId);
    if (result.success && result.room && result.player) {
      socket.join(result.room.roomId);
      const times = ClockService.getUpdatedTimes(result.room.clock);
      const syncedRoom = {
        ...result.room,
        clock: {
          ...result.room.clock,
          whiteTimeMs: times.whiteMs,
          blackTimeMs: times.blackMs,
        },
      };
      socket.emit('room:reconnected', { success: true, room: syncedRoom, player: result.player });
      socket.to(result.room.roomId).emit('room:opponent-reconnected', { player: result.player });
      io.to(result.room.roomId).emit('game:state', syncedRoom);
      if (typeof callback === 'function') callback({ success: true, room: syncedRoom, player: result.player });
    } else {
      if (typeof callback === 'function') callback({ success: false, error: result.error || 'Unable to reconnect' });
    }
  });
}
