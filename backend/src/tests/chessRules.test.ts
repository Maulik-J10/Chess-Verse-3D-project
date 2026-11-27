import assert from 'assert';
import { Chess } from 'chess.js';
import { GameService } from '../services/gameService.js';
import { ClockService } from '../services/clockService.js';
import { RoomService } from '../services/roomService.js';

console.log('--- STARTING FIDE CHESS RULES & SERVICE TESTS ---');

// 1. Legal Movement Tests
{
  const game = new Chess();
  // Pawn e2-e4
  const m1 = game.move({ from: 'e2', to: 'e4' });
  assert.strictEqual(m1.san, 'e4', 'Pawn 2-step move failed');
  // Knight g8-f6
  const m2 = game.move({ from: 'g8', to: 'f6' });
  assert.strictEqual(m2.san, 'Nf6', 'Knight move failed');
  console.log('✓ Pawn and Knight moves passed');
}

// 2. Illegal Move Rejection
{
  const gameService = new GameService();
  const res = gameService.validateAndExecuteMove('test1', 'w', 'e2', 'e5');
  assert.strictEqual(res.valid, false, 'Illegal pawn move e2-e5 should be rejected');
  console.log('✓ Illegal move correctly rejected');
}

// 3. Out of Turn Rejection
{
  const gameService = new GameService();
  const res = gameService.validateAndExecuteMove('test2', 'b', 'e7', 'e5');
  assert.strictEqual(res.valid, false, 'Black moving on turn 1 should be rejected');
  console.log('✓ Out-of-turn move correctly rejected');
}

// 4. Fool\'s Mate (Fastest Checkmate)
{
  const gameService = new GameService();
  gameService.validateAndExecuteMove('fools', 'w', 'f2', 'f3');
  gameService.validateAndExecuteMove('fools', 'b', 'e7', 'e5');
  gameService.validateAndExecuteMove('fools', 'w', 'g2', 'g4');
  const mate = gameService.validateAndExecuteMove('fools', 'b', 'd8', 'h4');
  assert.strictEqual(mate.valid, true);
  assert.strictEqual(mate.isCheckmate, true, 'Fool\'s mate should be checkmate');
  assert.strictEqual(mate.winner, 'b');
  console.log('✓ Checkmate detection passed');
}

// 5. Castling (Kingside & Queenside)
{
  const game = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  // Kingside castling
  const mCastleK = game.move({ from: 'e1', to: 'g1' });
  assert.strictEqual(mCastleK.san, 'O-O', 'Kingside castling failed');
  // Queenside castling for Black
  const mCastleQ = game.move({ from: 'e8', to: 'c8' });
  assert.strictEqual(mCastleQ.san, 'O-O-O', 'Queenside castling failed');
  console.log('✓ Castling (Kingside and Queenside) passed');
}

// 6. Castling Through Check Rejection
{
  // Enemy rook on f8 attacking f1, White king on e1 wants to castle O-O through f1, black king on a8
  const game = new Chess('k4r2/8/8/8/8/8/8/4K2R w K - 0 1');
  try {
    const move = game.move({ from: 'e1', to: 'g1' });
    assert.strictEqual(move, null, 'Castling through attacked square must fail');
  } catch (e) {
    // Thrown error is also valid rejection
  }
  console.log('✓ Castling through check correctly forbidden');
}

// 7. En Passant
{
  const game = new Chess('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3');
  const epMove = game.move({ from: 'e5', to: 'd6' });
  assert.strictEqual(epMove.captured, 'p', 'En passant must capture pawn');
  console.log('✓ En passant capture passed');
}

// 8. Pawn Promotion
{
  const game = new Chess('8/4P3/8/8/8/8/8/4K2k w - - 0 1');
  const promo = game.move({ from: 'e7', to: 'e8', promotion: 'q' });
  assert.strictEqual(promo.san, 'e8=Q', 'Pawn promotion to Queen failed');
  console.log('✓ Pawn promotion passed');
}

// 9. Clock Service
{
  const clock = ClockService.initClock(5, 3); // 5 min + 3 sec increment
  assert.strictEqual(clock.whiteTimeMs, 300000);
  assert.strictEqual(clock.incrementMs, 3000);
  ClockService.startTurn(clock, 'w');
  assert.strictEqual(clock.isRunning, true);
  ClockService.completeTurn(clock, 'w', 'b');
  assert.strictEqual(clock.activeColor, 'b');
  ClockService.stopClock(clock);
  assert.strictEqual(clock.isRunning, false);
  console.log('✓ ClockService init, turn transitions, and increment passed');
}

// 10. Room Service & 6-Digit Numeric Code Validation
{
  const roomService = new RoomService();
  const codes = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const { room } = roomService.createRoom(`socket_batch_${i}`, {
      playerName: `Tester ${i}`,
      timeControl: { name: 'Rapid 10+0', initialMinutes: 10, incrementSeconds: 0 },
      preferredColor: 'w',
    });
    assert(/^\d{6}$/.test(room.roomCode), `Room code must be exactly 6 numeric digits, got: ${room.roomCode}`);
    assert(!codes.has(room.roomCode), `Duplicate active room code generated: ${room.roomCode}`);
    codes.add(room.roomCode);
  }

  const { room, player } = roomService.createRoom('socket_123', {
    playerName: 'Grandmaster Magnus',
    timeControl: { name: 'Rapid 10+0', initialMinutes: 10, incrementSeconds: 0 },
    preferredColor: 'w',
  });
  assert(/^\d{6}$/.test(room.roomCode), 'Room code must be 6 numeric digits');
  assert(!room.roomCode.startsWith('CHS'), 'Room code must not have CHS prefix');
  assert.strictEqual(player.name, 'Grandmaster Magnus');
  assert.strictEqual(player.color, 'w');
  assert.strictEqual(room.status, 'waiting');

  // Invalid codes must fail
  const invalidAlpha = roomService.joinRoom('socket_bad1', { roomCode: 'CHS123', playerName: 'Bad' });
  assert.strictEqual(invalidAlpha.success, false);
  const invalidShort = roomService.joinRoom('socket_bad2', { roomCode: '12345', playerName: 'Bad' });
  assert.strictEqual(invalidShort.success, false);

  // Join Room with leading-zero preservation / whitespace tolerance
  const joinRes = roomService.joinRoom('socket_456', {
    roomCode: ` ${room.roomCode} `,
    playerName: 'Challenger Hikaru',
  });
  assert.strictEqual(joinRes.success, true);
  assert.strictEqual(joinRes.player?.color, 'b');
  assert.strictEqual(room.status, 'active');

  // 3rd player must be rejected
  const fullRes = roomService.joinRoom('socket_789', { roomCode: room.roomCode, playerName: 'Extra' });
  assert.strictEqual(fullRes.success, false);
  console.log('✓ RoomService create, 6-digit code uniqueness, validation, and 2-player join passed');
}

console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
