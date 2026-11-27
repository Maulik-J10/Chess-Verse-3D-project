import { randomBytes, randomInt } from 'crypto';

export class SessionValidator {
  public static generatePlayerId(): string {
    return 'ply_' + randomBytes(8).toString('hex');
  }

  /**
   * Generates a cryptographically strong 6-digit numeric room code (000000-999999),
   * always preserving leading zeros cleanly as a 6-character string.
   */
  public static generateRoomCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  public static normalizeRoomCode(raw: unknown): string {
    if (typeof raw !== 'string' && typeof raw !== 'number') return '';
    return String(raw).replace(/\s+/g, '').trim();
  }

  public static isValidRoomCode(code: string): boolean {
    return /^\d{6}$/.test(code);
  }

  public static sanitizeString(input: string, maxLen = 30): string {
    if (!input || typeof input !== 'string') return '';
    return input.trim().substring(0, maxLen).replace(/[^a-zA-Z0-9 _-]/g, '');
  }
}
