import { randomBytes } from 'crypto';

export class SessionValidator {
  public static generatePlayerId(): string {
    return 'ply_' + randomBytes(8).toString('hex');
  }

  public static generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'CHS';
    for (let i = 0; i < 3; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public static sanitizeString(input: string, maxLen = 30): string {
    if (!input || typeof input !== 'string') return '';
    return input.trim().substring(0, maxLen).replace(/[^a-zA-Z0-9 _-]/g, '');
  }
}

