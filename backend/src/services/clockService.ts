import { GameClockState, PieceColor } from '../types/index.js';

export class ClockService {
  public static initClock(initialMinutes: number, incrementSeconds: number): GameClockState {
    const ms = initialMinutes * 60 * 1000;
    return {
      whiteTimeMs: ms,
      blackTimeMs: ms,
      lastTurnStartTimeMs: 0,
      incrementMs: incrementSeconds * 1000,
      activeColor: 'w',
      isRunning: false,
    };
  }

  public static getUpdatedTimes(clock: GameClockState): { whiteMs: number; blackMs: number; hasTimedOut: boolean; timeoutColor?: PieceColor } {
    if (!clock.isRunning || clock.lastTurnStartTimeMs === 0) {
      return {
        whiteMs: Math.max(0, clock.whiteTimeMs),
        blackMs: Math.max(0, clock.blackTimeMs),
        hasTimedOut: false,
      };
    }

    const now = Date.now();
    const elapsed = now - clock.lastTurnStartTimeMs;

    let whiteMs = clock.whiteTimeMs;
    let blackMs = clock.blackTimeMs;

    if (clock.activeColor === 'w') {
      whiteMs -= elapsed;
    } else {
      blackMs -= elapsed;
    }

    if (whiteMs <= 0) {
      return { whiteMs: 0, blackMs, hasTimedOut: true, timeoutColor: 'w' };
    }
    if (blackMs <= 0) {
      return { whiteMs, blackMs: 0, hasTimedOut: true, timeoutColor: 'b' };
    }

    return { whiteMs, blackMs, hasTimedOut: false };
  }

  public static startTurn(clock: GameClockState, activeColor: PieceColor): void {
    clock.activeColor = activeColor;
    clock.lastTurnStartTimeMs = Date.now();
    clock.isRunning = true;
  }

  public static completeTurn(clock: GameClockState, completedColor: PieceColor, nextColor: PieceColor): void {
    const now = Date.now();
    if (clock.isRunning && clock.lastTurnStartTimeMs > 0) {
      const elapsed = now - clock.lastTurnStartTimeMs;
      if (completedColor === 'w') {
        clock.whiteTimeMs = Math.max(0, clock.whiteTimeMs - elapsed) + clock.incrementMs;
      } else {
        clock.blackTimeMs = Math.max(0, clock.blackTimeMs - elapsed) + clock.incrementMs;
      }
    }
    clock.activeColor = nextColor;
    clock.lastTurnStartTimeMs = now;
  }

  public static stopClock(clock: GameClockState): void {
    if (clock.isRunning && clock.lastTurnStartTimeMs > 0) {
      const elapsed = Date.now() - clock.lastTurnStartTimeMs;
      if (clock.activeColor === 'w') {
        clock.whiteTimeMs = Math.max(0, clock.whiteTimeMs - elapsed);
      } else {
        clock.blackTimeMs = Math.max(0, clock.blackTimeMs - elapsed);
      }
    }
    clock.isRunning = false;
    clock.lastTurnStartTimeMs = 0;
  }
}

