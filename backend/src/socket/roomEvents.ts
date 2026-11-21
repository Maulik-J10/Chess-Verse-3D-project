import { Server, Socket } from 'socket.io';
import { RoomService } from '../services/roomService.js';
import { GameService } from '../services/gameService.js';
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
      if (typeof callback === 'function') callback({ success: false, error: 'Rate limit exceeded' });
      return;
    }

    try {
      const { room, player } = roomService.createRoom(socket.id, payload);
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
      socket.emit('error', errRes);
      if (typeof callback === 'function') callback(errRes);
    }
  });

  // JOIN A ROOM
  socket.on('room:join', (payload: RoomJoinPayload, callback) => {
    if (!rateLimiter.isAllowed(socket.id)) {
      if (typeof callback === 'function') callback({ success: false, error: 'Rate limit exceeded' });
      return;
    }

    try {
      const result = roomService.joinRoom(socket.id, payload);
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

      // Notify the opponent in the room
      socket.to(result.room.roomId).emit('room:opponent-connected', {
        opponent: result.player,
        room: result.room,
      });

      // Broadcast game:state to room
      io.to(result.room.roomId).emit('game:state', result.room);

      if (typeof callback === 'function') callback({ success: true, room: result.room, player: result.player });
    } catch (err: any) {
      const errRes = { success: false, error: err?.message || 'Failed to join room' };
      socket.emit('error', errRes);
      if (typeof callback === 'function') callback(errRes);
    }
  });

  // RECONNECT TO EXISTING SESSION
  socket.on('room:reconnect', (payload: { roomId: string; playerId: string }, callback) => {
    const result = roomService.reconnectPlayer(socket.id, payload.roomId, payload.playerId);
    if (result.success && result.room && result.player) {
      socket.join(result.room.roomId);
      socket.emit('room:reconnected', { success: true, room: result.room, player: result.player });
      socket.to(result.room.roomId).emit('room:opponent-reconnected', { player: result.player });
      io.to(result.room.roomId).emit('game:state', result.room);
      if (typeof callback === 'function') callback({ success: true, room: result.room });
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'Unable to reconnect' });
    }
  });
}

