import type { Game, Player } from "./types";

export function displayName(player: Pick<Player, "nickname" | "realName">): string {
  return `${player.nickname} - ${player.realName}`;
}

export function winRate(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0;
  return wins / total;
}

export function formatWinRate(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return "-";
  return `${Math.round(winRate(wins, losses) * 100)}%`;
}

export function formatStreak(streak: number): string {
  if (streak === 0) return "-";
  if (streak > 0) return `W${streak}`;
  return `L${Math.abs(streak)}`;
}

export function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function formatScoreline(game: Pick<Game, "scoreA" | "scoreB" | "wentToDeuce" | "winner">): string {
  if (game.wentToDeuce || game.scoreA === null || game.scoreB === null) {
    return game.winner === "A" ? "Deuce (A)" : "Deuce (B)";
  }
  return `${game.scoreA}-${game.scoreB}`;
}