import { Server, Socket } from 'socket.io';
import { RoomService } from '../services/roomService.js';
import { GameService } from '../services/gameService.js';
import { ClockService } from '../services/clockService.js';
import { RateLimiter } from '../security/rateLimiter.js';
import { ClientMovePayload, MoveRecord, PieceColor } from '../types/index.js';

export function registerGameEvents(
  io: Server,
  socket: Socket,
  roomService: RoomService,
  gameService: GameService,
  rateLimiter: RateLimiter
) {
  // CLIENT SUBMITS A MOVE
  socket.on('game:move', (payload: ClientMovePayload, callback) => {
    if (!rateLimiter.isAllowed(socket.id)) {
      if (typeof callback === 'function') callback({ success: false, error: 'Move rate limit exceeded' });
      return;
    }

    const { roomCode, playerId, from, to, promotion } = payload;
    const room = roomService.getRoomByCode(roomCode);

    if (!room) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }

    if (room.status !== 'active' && room.status !== 'check') {
      if (typeof callback === 'function') callback({ success: false, error: 'Game is not in an active state' });
      return;
    }

    // Identify player
    let playerColor: PieceColor | null = null;
    if (room.players.white?.playerId === playerId) {
      playerColor = 'w';
    } else if (room.players.black?.playerId === playerId) {
      playerColor = 'b';
    }

    if (!playerColor) {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized player session' });
      return;
    }

    // Check timeout before executing move
    const times = ClockService.getUpdatedTimes(room.clock);
    if (times.hasTimedOut && times.timeoutColor) {
      roomService.timeoutGame(room.roomId, times.timeoutColor);
      io.to(room.roomId).emit('game:finished', {
        reason: 'timeout',
        winner: times.timeoutColor === 'w' ? 'b' : 'w',
        status: 'timeout',
        room,
      });
      if (typeof callback === 'function') callback({ success: false, error: 'Game finished on time' });
      return;
    }

    const fenBefore = room.fen;

    // Authoritative Move Validation
    const result = gameService.validateAndExecuteMove(
      room.roomId,
      playerColor,
      from,
      to,
      promotion
    );

    if (!result.valid || !result.san || !result.fen) {
      if (typeof callback === 'function') callback({ success: false, error: result.error || 'Illegal move' });
      return;
    }

    // Move is valid! Update room state
    room.fen = result.fen;
    const nextColor: PieceColor = playerColor === 'w' ? 'b' : 'w';

    // Update clocks
    ClockService.completeTurn(room.clock, playerColor, nextColor);

    const updatedClockTimes = ClockService.getUpdatedTimes(room.clock);

    const moveRecord: MoveRecord = {
      san: result.san,
      from,
      to,
      promotion,
      fenBefore,
      fenAfter: result.fen,
      timestamp: Date.now(),
      whiteTimeRemainingMs: updatedClockTimes.whiteMs,
      blackTimeRemainingMs: updatedClockTimes.blackMs,
    };

    room.history.push(moveRecord);

    if (result.gameStatus) {
      room.status = result.gameStatus;
    }
    if (result.winner) {
      room.winner = result.winner;
      ClockService.stopClock(room.clock);
    }

    const moveBroadcastPayload = {
      move: moveRecord,
      fen: result.fen,
      turn: nextColor,
      status: room.status,
      winner: room.winner,
      isCheck: result.isCheck,
      isCheckmate: result.isCheckmate,
      isDraw: result.isDraw,
      drawReason: result.drawReason,
      clock: {
        whiteTimeMs: updatedClockTimes.whiteMs,
        blackTimeMs: updatedClockTimes.blackMs,
        activeColor: nextColor,
        isRunning: !room.winner,
      },
    };

    // Broadcast move to both players
    io.to(room.roomId).emit('game:move', moveBroadcastPayload);
    io.to(room.roomId).emit('game:turn', { turn: nextColor });

    if (result.isCheck) {
      io.to(room.roomId).emit('game:check', { checkedColor: nextColor });
    }

    if (result.isCheckmate) {
      roomService.markRoomConcluded(room.roomId);
      io.to(room.roomId).emit('game:checkmate', { winner: playerColor, room });
      io.to(room.roomId).emit('game:finished', { reason: 'checkmate', winner: playerColor, room });
    } else if (result.isDraw) {
      roomService.markRoomConcluded(room.roomId);
      io.to(room.roomId).emit('game:draw', { reason: result.drawReason, room });
      io.to(room.roomId).emit('game:finished', { reason: result.drawReason, winner: 'draw', room });
    }

    if (typeof callback === 'function') {
      callback({ success: true, move: moveRecord });
    }
  });

  // RESIGNATION
  socket.on('game:resign', (payload: { roomCode: string; playerId: string }, callback) => {
    const room = roomService.getRoomByCode(payload.roomCode);
    if (!room) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }

    let playerColor: PieceColor | null = null;
    if (room.players.white?.playerId === payload.playerId) playerColor = 'w';
    else if (room.players.black?.playerId === payload.playerId) playerColor = 'b';

    if (!playerColor) {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized player' });
      return;
    }

    const res = roomService.resignGame(room.roomId, playerColor);
    if (res.success && res.room) {
      const winner = playerColor === 'w' ? 'b' : 'w';
      io.to(room.roomId).emit('game:resign', { resignedBy: playerColor, winner, room: res.room });
      io.to(room.roomId).emit('game:finished', { reason: 'resignation', winner, room: res.room });
      if (typeof callback === 'function') callback({ success: true });
    } else if (typeof callback === 'function') {
      callback({ success: false, error: 'Game cannot be resigned now' });
    }
  });

  // DRAW OFFER
  socket.on('game:offer-draw', (payload: { roomCode: string; playerId: string }, callback) => {
    const room = roomService.getRoomByCode(payload.roomCode);
    if (!room) return;

    let playerColor: PieceColor | null = null;
    if (room.players.white?.playerId === payload.playerId) playerColor = 'w';
    else if (room.players.black?.playerId === payload.playerId) playerColor = 'b';

    if (!playerColor) return;

    const res = roomService.offerDraw(room.roomId, playerColor);
    if (res.success) {
      socket.to(room.roomId).emit('game:offer-draw', { fromColor: playerColor });
      if (typeof callback === 'function') callback({ success: true });
    }
  });

  // ACCEPT DRAW
  socket.on('game:accept-draw', (payload: { roomCode: string; playerId: string }, callback) => {
    const room = roomService.getRoomByCode(payload.roomCode);
    if (!room || !room.drawOfferFrom) return;

    const res = roomService.resolveDrawOffer(room.roomId, true);
    if (res.success && res.room) {
      io.to(room.roomId).emit('game:accept-draw', { room: res.room });
      io.to(room.roomId).emit('game:finished', { reason: 'agreement', winner: 'draw', room: res.room });
      if (typeof callback === 'function') callback({ success: true });
    }
  });

  // REJECT DRAW
  socket.on('game:reject-draw', (payload: { roomCode: string; playerId: string }, callback) => {
    const room = roomService.getRoomByCode(payload.roomCode);
    if (!room) return;

    roomService.resolveDrawOffer(room.roomId, false);
    socket.to(room.roomId).emit('game:reject-draw');
    if (typeof callback === 'function') callback({ success: true });
  });

  // REMATCH / RESET ROOM SYNCHRONOUSLY FOR BOTH PLAYERS
  socket.on('game:rematch', (payload: { roomCode: string; playerId: string }, callback) => {
    const room = roomService.getRoomByCode(payload?.roomCode);
    if (!room) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }

    const isParticipant =
      room.players.white?.playerId === payload?.playerId ||
      room.players.black?.playerId === payload?.playerId;
    if (!isParticipant) {
      if (typeof callback === 'function') callback({ success: false, error: 'Unauthorized player' });
      return;
    }

    const res = roomService.rematchRoom(room.roomId);
    if (res.success && res.room) {
      gameService.removeGame(room.roomId);
      gameService.getOrCreateGame(room.roomId, res.room.fen);
      io.to(room.roomId).emit('game:rematch', { room: res.room });
      if (typeof callback === 'function') callback({ success: true, room: res.room });
    } else if (typeof callback === 'function') {
      callback({ success: false, error: 'Both players must be seated to rematch' });
    }
  });

  // DISCONNECT HANDLER
  socket.on('disconnect', () => {
    const { room, player } = roomService.handleDisconnect(socket.id);
    if (room && player) {
      socket.to(room.roomId).emit('room:opponent-disconnected', {
        playerColor: player.color,
        playerName: player.name,
        gracePeriodSeconds: 60,
      });
    }
  });
}

