import { chronologicalGames } from "./rating-history";
import { filterGames, playerWon, sideLabel } from "./filters";
import { formatScoreline, winRate } from "./format";
import type { Game, Player } from "./types";

const MIN_OPPONENT_GAMES = 2;

export interface OpponentRecord {
  opponentId: string;
  nickname: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface RecentResult {
  game: Game;
  won: boolean;
  opponents: string;
  scoreline: string;
  eloDelta: number;
}

export interface CareerAnalysis {
  player: Player;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  singlesWins: number;
  singlesLosses: number;
  doublesWins: number;
  doublesLosses: number;
  /** Sum of Elo deltas across all games with a snapshot. */
  eloDeltaCareer: number;
  /** First known before-Elo in career (null if no games). */
  eloStart: number | null;
  deuceGames: number;
  scoredGames: number;
  avgPointsFor: number | null;
  avgPointsAgainst: number | null;
  avgMargin: number | null;
  bestOpponents: OpponentRecord[];
  worstOpponents: OpponentRecord[];
  recent: RecentResult[];
}

export interface H2HMeeting {
  game: Game;
  playerWon: boolean;
  scoreline: string;
  playerDelta: number;
  vsDelta: number;
  playerPoints: number | null;
  vsPoints: number | null;
}

export interface H2HAnalysis {
  player: Player;
  vs: Player;
  games: number;
  playerWins: number;
  vsWins: number;
  playerEloDelta: number;
  vsEloDelta: number;
  scoredGames: number;
  avgPointsFor: number | null;
  avgPointsAgainst: number | null;
  meetings: H2HMeeting[];
}

function playerSideScores(
  game: Game,
  playerId: string
): { for: number; against: number } | null {
  if (game.scoreA === null || game.scoreB === null) return null;
  if (game.sideA.includes(playerId)) {
    return { for: game.scoreA, against: game.scoreB };
  }
  if (game.sideB.includes(playerId)) {
    return { for: game.scoreB, against: game.scoreA };
  }
  return null;
}

function opponentsInGame(game: Game, playerId: string): string[] {
  if (game.sideA.includes(playerId)) return [...game.sideB];
  if (game.sideB.includes(playerId)) return [...game.sideA];
  return [];
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function analyzeCareer(
  player: Player,
  players: Player[],
  games: Game[]
): CareerAnalysis {
  const byId = new Map(players.map((p) => [p.id, p]));
  const mine = chronologicalGames(
    games.filter(
      (g) => g.sideA.includes(player.id) || g.sideB.includes(player.id)
    )
  );

  let wins = 0;
  let losses = 0;
  let singlesWins = 0;
  let singlesLosses = 0;
  let doublesWins = 0;
  let doublesLosses = 0;
  let eloDeltaCareer = 0;
  let eloStart: number | null = null;
  let deuceGames = 0;
  const pointsFor: number[] = [];
  const pointsAgainst: number[] = [];
  const margins: number[] = [];

  const vsMap = new Map<
    string,
    { games: number; wins: number; losses: number }
  >();

  for (const g of mine) {
    const won = playerWon(g, player.id);
    if (won) wins++;
    else losses++;

    if (g.format === "singles") {
      if (won) singlesWins++;
      else singlesLosses++;
    } else {
      if (won) doublesWins++;
      else doublesLosses++;
    }

    if (g.wentToDeuce) deuceGames++;

    const snap = g.eloChanges[player.id];
    if (snap) {
      eloDeltaCareer += snap.delta;
      if (eloStart === null) eloStart = snap.before;
    }

    const scores = playerSideScores(g, player.id);
    if (scores) {
      pointsFor.push(scores.for);
      pointsAgainst.push(scores.against);
      margins.push(scores.for - scores.against);
    }

    for (const oppId of opponentsInGame(g, player.id)) {
      const cur = vsMap.get(oppId) ?? { games: 0, wins: 0, losses: 0 };
      cur.games++;
      if (won) cur.wins++;
      else cur.losses++;
      vsMap.set(oppId, cur);
    }
  }

  const opponents: OpponentRecord[] = [...vsMap.entries()]
    .map(([opponentId, rec]) => ({
      opponentId,
      nickname: byId.get(opponentId)?.nickname ?? "?",
      games: rec.games,
      wins: rec.wins,
      losses: rec.losses,
      winRate: winRate(rec.wins, rec.losses),
    }))
    .filter((o) => o.games >= MIN_OPPONENT_GAMES);

  const byWinThenSample = (a: OpponentRecord, b: OpponentRecord) =>
    b.winRate - a.winRate || b.games - a.games || a.nickname.localeCompare(b.nickname);

  const bestOpponents = [...opponents].sort(byWinThenSample).slice(0, 5);
  const worstOpponents = [...opponents]
    .sort(
      (a, b) =>
        a.winRate - b.winRate || b.games - a.games || a.nickname.localeCompare(b.nickname)
    )
    .slice(0, 5);

  const recent: RecentResult[] = [...mine]
    .reverse()
    .slice(0, 8)
    .map((g) => ({
      game: g,
      won: playerWon(g, player.id),
      opponents: sideLabel(opponentsInGame(g, player.id), byId),
      scoreline: formatScoreline(g),
      eloDelta: g.eloChanges[player.id]?.delta ?? 0,
    }));

  return {
    player,
    games: mine.length,
    wins,
    losses,
    winRate: winRate(wins, losses),
    singlesWins,
    singlesLosses,
    doublesWins,
    doublesLosses,
    eloDeltaCareer,
    eloStart,
    deuceGames,
    scoredGames: pointsFor.length,
    avgPointsFor: avg(pointsFor),
    avgPointsAgainst: avg(pointsAgainst),
    avgMargin: avg(margins),
    bestOpponents,
    worstOpponents,
    recent,
  };
}

export function analyzeH2H(
  player: Player,
  vs: Player,
  players: Player[],
  games: Game[]
): H2HAnalysis {
  const meetingsChrono = chronologicalGames(
    filterGames(games, {
      format: "all",
      playerId: player.id,
      vsPlayerId: vs.id,
      deuce: "all",
    })
  );

  let playerWins = 0;
  let vsWins = 0;
  let playerEloDelta = 0;
  let vsEloDelta = 0;
  const pointsFor: number[] = [];
  const pointsAgainst: number[] = [];

  const meetings: H2HMeeting[] = meetingsChrono.map((g) => {
    const won = playerWon(g, player.id);
    if (won) playerWins++;
    else vsWins++;

    const pSnap = g.eloChanges[player.id];
    const vSnap = g.eloChanges[vs.id];
    if (pSnap) playerEloDelta += pSnap.delta;
    if (vSnap) vsEloDelta += vSnap.delta;

    const scores = playerSideScores(g, player.id);
    if (scores) {
      pointsFor.push(scores.for);
      pointsAgainst.push(scores.against);
    }

    return {
      game: g,
      playerWon: won,
      scoreline: formatScoreline(g),
      playerDelta: pSnap?.delta ?? 0,
      vsDelta: vSnap?.delta ?? 0,
      playerPoints: scores?.for ?? null,
      vsPoints: scores?.against ?? null,
    };
  });

  return {
    player,
    vs,
    games: meetings.length,
    playerWins,
    vsWins,
    playerEloDelta,
    vsEloDelta,
    scoredGames: pointsFor.length,
    avgPointsFor: avg(pointsFor),
    avgPointsAgainst: avg(pointsAgainst),
    meetings: [...meetings].reverse(),
  };
}
