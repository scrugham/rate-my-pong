import type { Game, Player } from "./types";
import { winRate } from "./format";
import { playerWon, sideLabel } from "./filters";

const UPSET_THRESHOLD = 100;

export interface PlayerPeriodStats {
  player: Player;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  eloDelta: number;
  avgMargin: number | null;
  deuceGames: number;
  singles: number;
  doubles: number;
}

export interface UpsetRow {
  game: Game;
  eloGap: number;
  winners: string;
  losers: string;
}

export interface RivalryRow {
  key: string;
  label: string;
  games: number;
  aWins: number;
  bWins: number;
}

export interface ExploreBundle {
  games: Game[];
  totalGames: number;
  singlesGames: number;
  doublesGames: number;
  deuceGames: number;
  uniquePlayers: number;
  avgScoreMargin: number | null;
  thrillers: number;
  blowouts: number;
  playerStats: PlayerPeriodStats[];
  upsets: UpsetRow[];
  rivalries: RivalryRow[];
  scoreMargins: { margin: number; count: number }[];
  eloSwingGames: { game: Game; swing: number; label: string }[];
}

function matchupKey(sideA: string[], sideB: string[]): string {
  const a = [...sideA].sort().join("+");
  const b = [...sideB].sort().join("+");
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

export function exploreGames(players: Player[], games: Game[]): ExploreBundle {
  const byId = new Map(players.map((p) => [p.id, p]));
  const activeIds = new Set<string>();
  for (const g of games) {
    for (const id of [...g.sideA, ...g.sideB]) activeIds.add(id);
  }

  const statsMap = new Map<
    string,
    {
      games: number;
      wins: number;
      losses: number;
      eloDelta: number;
      marginTotal: number;
      marginGames: number;
      deuceGames: number;
      singles: number;
      doubles: number;
    }
  >();

  const ensure = (id: string) => {
    let s = statsMap.get(id);
    if (!s) {
      s = {
        games: 0,
        wins: 0,
        losses: 0,
        eloDelta: 0,
        marginTotal: 0,
        marginGames: 0,
        deuceGames: 0,
        singles: 0,
        doubles: 0,
      };
      statsMap.set(id, s);
    }
    return s;
  };

  let marginSum = 0;
  let marginN = 0;
  let thrillers = 0;
  let blowouts = 0;
  const marginHist = new Map<number, number>();

  for (const g of games) {
    if (g.wentToDeuce || g.scoreA === null || g.scoreB === null) {
      thrillers += 1;
    } else {
      const margin = Math.abs(g.scoreA - g.scoreB);
      marginSum += margin;
      marginN += 1;
      marginHist.set(margin, (marginHist.get(margin) ?? 0) + 1);
      if (margin <= 2) thrillers += 1;
      if (margin >= 6) blowouts += 1;
    }

    for (const id of [...g.sideA, ...g.sideB]) {
      const s = ensure(id);
      s.games += 1;
      if (g.format === "singles") s.singles += 1;
      else s.doubles += 1;
      if (g.wentToDeuce) s.deuceGames += 1;
      const won = playerWon(g, id);
      if (won) s.wins += 1;
      else s.losses += 1;
      const snap = g.eloChanges[id];
      if (snap) s.eloDelta += snap.delta;
      if (won && g.scoreA !== null && g.scoreB !== null) {
        s.marginTotal += Math.abs(g.scoreA - g.scoreB);
        s.marginGames += 1;
      }
    }
  }

  const playerStats: PlayerPeriodStats[] = [...statsMap.entries()]
    .map(([id, s]) => {
      const player = byId.get(id);
      if (!player) return null;
      return {
        player,
        games: s.games,
        wins: s.wins,
        losses: s.losses,
        winRate: winRate(s.wins, s.losses),
        eloDelta: s.eloDelta,
        avgMargin: s.marginGames > 0 ? s.marginTotal / s.marginGames : null,
        deuceGames: s.deuceGames,
        singles: s.singles,
        doubles: s.doubles,
      };
    })
    .filter((x): x is PlayerPeriodStats => x !== null)
    .sort((a, b) => b.eloDelta - a.eloDelta || b.games - a.games);

  const upsets: UpsetRow[] = [];
  for (const g of games) {
    const winnerElo = g.winner === "A" ? g.teamEloA : g.teamEloB;
    const loserElo = g.winner === "A" ? g.teamEloB : g.teamEloA;
    const eloGap = loserElo - winnerElo;
    if (eloGap < UPSET_THRESHOLD) continue;
    const winners = g.winner === "A" ? g.sideA : g.sideB;
    const losers = g.winner === "A" ? g.sideB : g.sideA;
    upsets.push({
      game: g,
      eloGap,
      winners: sideLabel(winners, byId),
      losers: sideLabel(losers, byId),
    });
  }
  upsets.sort((a, b) => b.eloGap - a.eloGap);

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
      label:
        aSorted < bSorted
          ? `${sideLabel(g.sideA, byId)} vs ${sideLabel(g.sideB, byId)}`
          : `${sideLabel(g.sideB, byId)} vs ${sideLabel(g.sideA, byId)}`,
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
    .sort((a, b) => b.games - a.games);

  const eloSwingGames = [...games]
    .map((g) => {
      const swings = Object.values(g.eloChanges).map((c) => Math.abs(c.delta));
      const swing = swings.length ? Math.max(...swings) : 0;
      return {
        game: g,
        swing,
        label: `${sideLabel(g.sideA, byId)} vs ${sideLabel(g.sideB, byId)}`,
      };
    })
    .sort((a, b) => b.swing - a.swing)
    .slice(0, 10);

  return {
    games,
    totalGames: games.length,
    singlesGames: games.filter((g) => g.format === "singles").length,
    doublesGames: games.filter((g) => g.format === "doubles").length,
    deuceGames: games.filter((g) => g.wentToDeuce).length,
    uniquePlayers: activeIds.size,
    avgScoreMargin: marginN > 0 ? marginSum / marginN : null,
    thrillers,
    blowouts,
    playerStats,
    upsets,
    rivalries,
    scoreMargins: [...marginHist.entries()]
      .map(([margin, count]) => ({ margin, count }))
      .sort((a, b) => a.margin - b.margin),
    eloSwingGames,
  };
}
