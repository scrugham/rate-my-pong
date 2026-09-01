import type { Game, MatchFormat, Player } from "./types";

export type FormatFilter = "all" | MatchFormat;
export type DeuceFilter = "all" | "deuce" | "exact";

export interface GameFilters {
  format: FormatFilter;
  playerId: string | null;
  deuce: DeuceFilter;
  /** Second player for head-to-head (optional). */
  vsPlayerId?: string | null;
}

export function filterGames(games: Game[], filters: GameFilters): Game[] {
  return games.filter((g) => {
    if (filters.format !== "all" && g.format !== filters.format) return false;
    if (filters.deuce === "deuce" && !g.wentToDeuce) return false;
    if (filters.deuce === "exact" && g.wentToDeuce) return false;

    const ids = [...g.sideA, ...g.sideB];
    if (filters.playerId && !ids.includes(filters.playerId)) return false;
    if (filters.vsPlayerId && !ids.includes(filters.vsPlayerId)) return false;

    if (filters.playerId && filters.vsPlayerId) {
      const aHasP =
        g.sideA.includes(filters.playerId) || g.sideB.includes(filters.playerId);
      const aHasV =
        g.sideA.includes(filters.vsPlayerId) ||
        g.sideB.includes(filters.vsPlayerId);
      if (!aHasP || !aHasV) return false;
      // Must be on opposite sides
      const pOnA = g.sideA.includes(filters.playerId);
      const vOnA = g.sideA.includes(filters.vsPlayerId);
      if (pOnA === vOnA) return false;
    }

    return true;
  });
}

export function sideLabel(ids: string[], byId: Map<string, Player>): string {
  return ids.map((id) => byId.get(id)?.nickname ?? "?").join(" & ");
}

export function gameInvolves(game: Game, playerId: string): boolean {
  return game.sideA.includes(playerId) || game.sideB.includes(playerId);
}

export function playerWon(game: Game, playerId: string): boolean {
  if (game.sideA.includes(playerId)) return game.winner === "A";
  if (game.sideB.includes(playerId)) return game.winner === "B";
  return false;
}
