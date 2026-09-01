export type MatchFormat = "singles" | "doubles";
export type ScoreMode = "exact" | "deuce";

export interface Player {
  id: string;
  realName: string;
  nickname: string;
  elo: number;
  wins: number;
  losses: number;
  singlesWins: number;
  singlesLosses: number;
  doublesWins: number;
  doublesLosses: number;
  streak: number;
  createdAt: string;
  lastPlayedAt: string | null;
}

export interface EloSnapshot {
  before: number;
  after: number;
  delta: number;
}

export interface Game {
  id: string;
  format: MatchFormat;
  sideA: string[];
  sideB: string[];
  /** Null when logged as a deuce win without remembering the final tally. */
  scoreA: number | null;
  scoreB: number | null;
  winner: "A" | "B";
  wentToDeuce: boolean;
  playedAt: string;
  eloChanges: Record<string, EloSnapshot>;
  teamEloA: number;
  teamEloB: number;
}

export interface Database {
  players: Player[];
  games: Game[];
}

export interface CreatePlayerInput {
  realName: string;
  nickname: string;
}

export interface CreateGameInput {
  format: MatchFormat;
  sideA: string[];
  sideB: string[];
  /** Use exact scores, or deuce mode with an explicit winner. */
  scoreMode: ScoreMode;
  scoreA?: number;
  scoreB?: number;
  winner?: "A" | "B";
}
