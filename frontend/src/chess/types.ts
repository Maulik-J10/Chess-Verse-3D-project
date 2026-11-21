export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';

export type GameMode = 'menu' | 'ai' | 'friend' | 'lobby';

export type AIDifficulty = 
  | 'beginner'
  | 'easy'
  | 'intermediate'
  | 'advanced'
  | 'expert'
  | 'grandmaster'
  | 'maximum';

export interface AIDifficultyConfig {
  label: string;
  elo: number;
  skillLevel: number;
  depth: number;
  movetime: number;
  description: string;
}

export const AI_DIFFICULTIES: Record<AIDifficulty, AIDifficultyConfig> = {
  beginner: {
    label: 'Beginner',
    elo: 800,
    skillLevel: 1,
    depth: 2,
    movetime: 250,
    description: 'Casual player learning the basics. Makes frequent errors.',
  },
  easy: {
    label: 'Easy',
    elo: 1200,
    skillLevel: 4,
    depth: 4,
    movetime: 500,
    description: 'Club beginner. Basic tactics and opening principles.',
  },
  intermediate: {
    label: 'Intermediate',
    elo: 1600,
    skillLevel: 8,
    depth: 8,
    movetime: 800,
    description: 'Solid intermediate player. Defends well against obvious threats.',
  },
  advanced: {
    label: 'Advanced',
    elo: 2000,
    skillLevel: 13,
    depth: 12,
    movetime: 1200,
    description: 'Strong candidate master level. Formidable positional play.',
  },
  expert: {
    label: 'Expert',
    elo: 2400,
    skillLevel: 17,
    depth: 16,
    movetime: 1800,
    description: 'FIDE Master strength. Sharp calculations and deep endgame knowledge.',
  },
  grandmaster: {
    label: 'Grandmaster',
    elo: 2800,
    skillLevel: 20,
    depth: 20,
    movetime: 2500,
    description: 'Super Grandmaster level. Ruthlessly punishes any minor inaccuracies.',
  },
  maximum: {
    label: 'Maximum Engine Strength',
    elo: 3500,
    skillLevel: 20,
    depth: 24,
    movetime: 3500,
    description: 'Maximum Stockfish NNUE capability. Virtually invincible (~1% human win rate).',
  },
};

export type CameraPreset = 
  | 'front'
  | 'top'
  | 'white'
  | 'black'
  | 'cinematic'
  | 'free';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export interface TimeControlPreset {
  id: string;
  name: string;
  category: 'bullet' | 'blitz' | 'rapid' | 'classical' | 'unlimited';
  minutes: number;
  increment: number;
}

export const TIME_CONTROLS: TimeControlPreset[] = [
  { id: '1-0', name: 'Bullet 1+0', category: 'bullet', minutes: 1, increment: 0 },
  { id: '2-1', name: 'Bullet 2+1', category: 'bullet', minutes: 2, increment: 1 },
  { id: '3-0', name: 'Blitz 3+0', category: 'blitz', minutes: 3, increment: 0 },
  { id: '3-2', name: 'Blitz 3+2', category: 'blitz', minutes: 3, increment: 2 },
  { id: '5-0', name: 'Blitz 5+0', category: 'blitz', minutes: 5, increment: 0 },
  { id: '10-0', name: 'Rapid 10+0', category: 'rapid', minutes: 10, increment: 0 },
  { id: '15-10', name: 'Rapid 15+10', category: 'rapid', minutes: 15, increment: 10 },
  { id: '30-0', name: 'Classical 30+0', category: 'classical', minutes: 30, increment: 0 },
  { id: 'unlimited', name: 'Unlimited', category: 'unlimited', minutes: 0, increment: 0 },
];

export interface PieceData {
  id: string;
  type: PieceType;
  color: PieceColor;
  square: string; // e.g. 'e4'
  hasMoved?: boolean;
}

export interface LegalMoveInfo {
  from: string;
  to: string;
  san: string;
  captured?: PieceType;
  isEnPassant?: boolean;
  isCastle?: boolean;
  promotion?: PieceType;
}

export interface MoveHistoryItem {
  san: string;
  from: string;
  to: string;
  color: PieceColor;
  fen: string;
  captured?: PieceType;
}

