import { STARTING_ELO } from "./elo";
import { formatScoreline } from "./format";
import { sideLabel } from "./filters";
import type { Game, Player } from "./types";

export interface RatingPoint {
  /** Index along the filtered match axis (start may be 0; plays are 1..n). */
  matchIndex: number;
  elo: number;
  delta: number;
  opponents: string;
  scoreline: string;
  /** Carried-forward Elo across matches the player sat out (stock last-price hold). */
  held?: boolean;
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

/** Fill every match after a player appears, holding last Elo when they sit out. */
export function expandFlatHold(
  points: RatingPoint[],
  lastMatchIndex: number
): RatingPoint[] {
  if (points.length === 0 || lastMatchIndex < 0) return points;
  const sorted = [...points].sort((a, b) => a.matchIndex - b.matchIndex);
  const at = new Map(sorted.map((p) => [p.matchIndex, p]));
  const start = sorted[0].matchIndex;
  const out: RatingPoint[] = [];
  let elo = sorted[0].elo;
  for (let m = start; m <= lastMatchIndex; m++) {
    const real = at.get(m);
    if (real) {
      elo = real.elo;
      out.push({ ...real, held: false });
    } else {
      out.push({
        matchIndex: m,
        elo,
        delta: 0,
        opponents: "",
        scoreline: "",
        held: true,
      });
    }
  }
  return out;
}

export function ratingSeriesForPlayers(
  playerIds: string[],
  players: Player[],
  games: Game[]
): RatingSeries[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const ordered = chronologicalGames(games);
  const lastMatchIndex = ordered.length;

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

      const sparse: RatingPoint[] = [
        {
          matchIndex: Math.max(0, firstIndex),
          elo: startElo,
          delta: 0,
          opponents: "Starting rating",
          scoreline: "",
        },
        ...points,
      ];

      return {
        playerId: id,
        nickname: player.nickname,
        points: expandFlatHold(sparse, lastMatchIndex),
      };
    })
    .filter((s): s is RatingSeries => s !== null);
}
