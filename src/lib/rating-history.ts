import { STARTING_ELO } from "./elo";
import { formatScoreline } from "./format";
import { sideLabel } from "./filters";
import type { Game, Player } from "./types";

export interface RatingPoint {
  /** 1-based index in the filtered match list (oldest first). */
  matchIndex: number;
  elo: number;
  delta: number;
  opponents: string;
  scoreline: string;
}

export interface RatingSeries {
  playerId: string;
  nickname: string;
  points: RatingPoint[];
}

export function chronologicalGames(games: Game[]): Game[] {
  return [...games].sort(
    (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
  );
}

export function ratingSeriesForPlayers(
  playerIds: string[],
  players: Player[],
  games: Game[]
): RatingSeries[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const ordered = chronologicalGames(games);

  return playerIds
    .map((id) => {
      const player = byId.get(id);
      if (!player) return null;

      const points: RatingPoint[] = [];
      ordered.forEach((g, i) => {
        const snap = g.eloChanges[id];
        if (!snap) return;
        const opponents = g.sideA.includes(id) ? g.sideB : g.sideA;
        points.push({
          matchIndex: i + 1,
          elo: snap.after,
          delta: snap.delta,
          opponents: sideLabel(opponents, byId),
          scoreline: formatScoreline(g),
        });
      });

      if (points.length === 0) return null;

      const firstIndex = ordered.findIndex((g) => g.eloChanges[id]);
      const startElo =
        firstIndex >= 0
          ? (ordered[firstIndex].eloChanges[id]?.before ?? STARTING_ELO)
          : STARTING_ELO;

      return {
        playerId: id,
        nickname: player.nickname,
        points: [
          {
            matchIndex: Math.max(0, firstIndex),
            elo: startElo,
            delta: 0,
            opponents: "Starting rating",
            scoreline: "",
          },
          ...points,
        ],
      };
    })
    .filter((s): s is RatingSeries => s !== null);
}
