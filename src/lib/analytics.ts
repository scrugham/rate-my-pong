import type { Database, Game, Player } from "./types";
import { displayName, winRate } from "./format";

const UPSET_THRESHOLD = 100;
const MIN_FORMAT_GAMES = 3;

export interface AnalyticsBundle {
  totalGames: number;
  totalPlayers: number;
  gamesLast7d: number;
  activePlayersLast7d: number;
  singlesGames: number;
  doublesGames: number;
  hottest: { player: Player; delta7d: number } | null;
  coldest: { player: Player; delta7d: number } | null;
  longestStreak: { player: Player; streak: number } | null;
  biggestUpset: {
    game: Game;
    margin: number;
    winners: string[];
    losers: string[];
  } | null;
  rivalries: {
    key: string;
    label: string;
    games: number;
    aWins: number;
    bWins: number;
  }[];
  singlesKing: { player: Player; winRate: number; games: number } | null;
  doublesMenace: { player: Player; winRate: number; games: number } | null;
  cruelest: { player: Player; avgMargin: number; games: number } | null;
  thrillers: number;
  recentDeltas: { playerId: string; delta7d: number }[];
}

function playerMap(players: Player[]): Map<string, Player> {
  return new Map(players.map((p) => [p.id, p]));
}

function eloDelta7d(playerId: string, games: Game[], since: number): number {
  let delta = 0;
  for (const g of games) {
    if (new Date(g.playedAt).getTime() < since) continue;
    const change = g.eloChanges[playerId];
    if (change) delta += change.delta;
  }
  return delta;
}

function matchupKey(sideA: string[], sideB: string[]): string {
  const a = [...sideA].sort().join("+");
  const b = [...sideB].sort().join("+");
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

function matchupLabel(
  sideA: string[],
  sideB: string[],
  players: Map<string, Player>
): string {
  const names = (ids: string[]) =>
    ids
      .map((id) => players.get(id)?.nickname ?? "?")
      .join(" & ");
  const a = [...sideA].sort().join("+");
  const b = [...sideB].sort().join("+");
  if (a < b) return `${names(sideA)} vs ${names(sideB)}`;
  return `${names(sideB)} vs ${names(sideA)}`;
}

function formatSpecialist(
  players: Player[],
  kind: "singles" | "doubles"
): { player: Player; winRate: number; games: number } | null {
  const ranked = players
    .map((p) => {
      const wins = kind === "singles" ? p.singlesWins : p.doublesWins;
      const losses = kind === "singles" ? p.singlesLosses : p.doublesLosses;
      const games = wins + losses;
      return { player: p, winRate: winRate(wins, losses), games };
    })
    .filter((x) => x.games >= MIN_FORMAT_GAMES)
    .sort((a, b) => b.winRate - a.winRate || b.games - a.games);

  return ranked[0] ?? null;
}

export function computeAnalytics(db: Database): AnalyticsBundle {
  const { players, games } = db;
  const byId = playerMap(players);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const gamesLast7d = games.filter(
    (g) => new Date(g.playedAt).getTime() >= weekAgo
  );
  const activeIds = new Set<string>();
  for (const g of gamesLast7d) {
    for (const id of [...g.sideA, ...g.sideB]) activeIds.add(id);
  }

  const recentDeltas = players.map((p) => ({
    playerId: p.id,
    delta7d: eloDelta7d(p.id, games, weekAgo),
  }));

  const sortedHot = [...recentDeltas].sort((a, b) => b.delta7d - a.delta7d);
  const hot = sortedHot[0];
  const cold = sortedHot[sortedHot.length - 1];

  const streakPlayer = [...players]
    .filter((p) => p.streak !== 0)
    .sort((a, b) => Math.abs(b.streak) - Math.abs(a.streak))[0];

  let biggestUpset: AnalyticsBundle["biggestUpset"] = null;
  for (const g of games) {
    const winnerElo = g.winner === "A" ? g.teamEloA : g.teamEloB;
    const loserElo = g.winner === "A" ? g.teamEloB : g.teamEloA;
    const margin = loserElo - winnerElo;
    if (margin < UPSET_THRESHOLD) continue;
    if (!biggestUpset || margin > biggestUpset.margin) {
      const winners = g.winner === "A" ? g.sideA : g.sideB;
      const losers = g.winner === "A" ? g.sideB : g.sideA;
      biggestUpset = {
        game: g,
        margin,
        winners: winners.map((id) => {
          const p = byId.get(id);
          return p ? displayName(p) : id;
        }),
        losers: losers.map((id) => {
          const p = byId.get(id);
          return p ? displayName(p) : id;
        }),
      };
    }
  }

  const rivalryMap = new Map<
    string,
    { label: string; games: number; aWins: number; bWins: number; aKey: string }
  >();

  for (const g of games) {
    const key = matchupKey(g.sideA, g.sideB);
    const aSorted = [...g.sideA].sort().join("+");
    const bSorted = [...g.sideB].sort().join("+");
    const canonicalA = aSorted < bSorted ? aSorted : bSorted;
    const existing = rivalryMap.get(key) ?? {
      label: matchupLabel(g.sideA, g.sideB, byId),
      games: 0,
      aWins: 0,
      bWins: 0,
      aKey: canonicalA,
    };
    existing.games += 1;
    const winnerKey =
      g.winner === "A"
        ? [...g.sideA].sort().join("+")
        : [...g.sideB].sort().join("+");
    if (winnerKey === existing.aKey) existing.aWins += 1;
    else existing.bWins += 1;
    rivalryMap.set(key, existing);
  }

  const rivalries = [...rivalryMap.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      games: v.games,
      aWins: v.aWins,
      bWins: v.bWins,
    }))
    .filter((r) => r.games >= 2)
    .sort((a, b) => b.games - a.games)
    .slice(0, 5);

  const marginByPlayer = new Map<string, { total: number; games: number }>();
  let thrillers = 0;
  for (const g of games) {
    if (g.wentToDeuce || g.scoreA === null || g.scoreB === null) {
      thrillers += 1;
    } else {
      const margin = Math.abs(g.scoreA - g.scoreB);
      if (margin <= 2) thrillers += 1;
      const winners = g.winner === "A" ? g.sideA : g.sideB;
      for (const id of winners) {
        const cur = marginByPlayer.get(id) ?? { total: 0, games: 0 };
        cur.total += margin;
        cur.games += 1;
        marginByPlayer.set(id, cur);
      }
    }
  }

  const cruelest = [...marginByPlayer.entries()]
    .map(([id, v]) => {
      const player = byId.get(id);
      if (!player || v.games < 2) return null;
      return { player, avgMargin: v.total / v.games, games: v.games };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.avgMargin - a.avgMargin)[0] ?? null;

  return {
    totalGames: games.length,
    totalPlayers: players.length,
    gamesLast7d: gamesLast7d.length,
    activePlayersLast7d: activeIds.size,
    singlesGames: games.filter((g) => g.format === "singles").length,
    doublesGames: games.filter((g) => g.format === "doubles").length,
    hottest:
      hot && hot.delta7d > 0
        ? { player: byId.get(hot.playerId)!, delta7d: hot.delta7d }
        : null,
    coldest:
      cold && cold.delta7d < 0
        ? { player: byId.get(cold.playerId)!, delta7d: cold.delta7d }
        : null,
    longestStreak: streakPlayer
      ? { player: streakPlayer, streak: streakPlayer.streak }
      : null,
    biggestUpset,
    rivalries,
    singlesKing: formatSpecialist(players, "singles"),
    doublesMenace: formatSpecialist(players, "doubles"),
    cruelest,
    thrillers,
    recentDeltas,
  };
}
