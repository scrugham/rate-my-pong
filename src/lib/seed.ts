import { randomUUID } from "crypto";
import { applyMatchElo, STARTING_ELO } from "./elo";
import type { Database, Game, MatchFormat, Player } from "./types";

type SeedPlayer = { nickname: string; realName: string };

const SEED_PLAYERS: SeedPlayer[] = [
  { nickname: "King Zach", realName: "Zach Evans" },
  { nickname: "Ace", realName: "Alex Rivera" },
  { nickname: "SpinDoctor", realName: "Jordan Lee" },
  { nickname: "PaddleCat", realName: "Sam Ortiz" },
  { nickname: "NetNinja", realName: "Taylor Brooks" },
  { nickname: "LobStar", realName: "Casey Nguyen" },
  { nickname: "SmashHit", realName: "Morgan Blake" },
  { nickname: "Backhand", realName: "Riley Quinn" },
];

interface SeedMatch {
  daysAgo: number;
  hour: number;
  format: MatchFormat;
  a: string[];
  b: string[];
  scoreA: number | null;
  scoreB: number | null;
  wentToDeuce?: boolean;
  winner?: "A" | "B";
}

const SEED_MATCHES: SeedMatch[] = [
  { daysAgo: 12, hour: 12, format: "singles", a: ["King Zach"], b: ["Ace"], scoreA: 11, scoreB: 7 },
  { daysAgo: 11, hour: 13, format: "singles", a: ["SpinDoctor"], b: ["PaddleCat"], scoreA: 11, scoreB: 9 },
  { daysAgo: 10, hour: 12, format: "doubles", a: ["King Zach", "LobStar"], b: ["Ace", "NetNinja"], scoreA: 11, scoreB: 5 },
  { daysAgo: 9, hour: 17, format: "singles", a: ["SmashHit"], b: ["Backhand"], scoreA: 8, scoreB: 11 },
  { daysAgo: 8, hour: 12, format: "singles", a: ["Ace"], b: ["SpinDoctor"], scoreA: 11, scoreB: 4 },
  { daysAgo: 7, hour: 13, format: "doubles", a: ["PaddleCat", "Backhand"], b: ["SmashHit", "LobStar"], scoreA: 9, scoreB: 11 },
  { daysAgo: 6, hour: 12, format: "singles", a: ["King Zach"], b: ["NetNinja"], scoreA: 11, scoreB: 8 },
  { daysAgo: 5, hour: 18, format: "singles", a: ["Ace"], b: ["King Zach"], scoreA: 11, scoreB: 9 },
  { daysAgo: 4, hour: 12, format: "doubles", a: ["Ace", "SpinDoctor"], b: ["King Zach", "PaddleCat"], scoreA: 6, scoreB: 11 },
  { daysAgo: 3, hour: 13, format: "singles", a: ["LobStar"], b: ["SmashHit"], scoreA: 12, scoreB: 10 },
  { daysAgo: 2, hour: 12, format: "singles", a: ["SpinDoctor"], b: ["Backhand"], scoreA: 11, scoreB: 3 },
  { daysAgo: 2, hour: 17, format: "doubles", a: ["NetNinja", "SmashHit"], b: ["LobStar", "Ace"], scoreA: 11, scoreB: 7 },
  { daysAgo: 1, hour: 12, format: "singles", a: ["King Zach"], b: ["PaddleCat"], scoreA: 11, scoreB: 6 },
  { daysAgo: 1, hour: 13, format: "singles", a: ["Ace"], b: ["Backhand"], scoreA: 9, scoreB: 11 },
  {
    daysAgo: 0,
    hour: 12,
    format: "doubles",
    a: ["King Zach", "Ace"],
    b: ["SpinDoctor", "NetNinja"],
    scoreA: null,
    scoreB: null,
    wentToDeuce: true,
    winner: "A",
  },
  { daysAgo: 0, hour: 13, format: "singles", a: ["PaddleCat"], b: ["LobStar"], scoreA: 11, scoreB: 9 },
];

function applyResult(player: Player, won: boolean, format: MatchFormat) {
  if (won) {
    player.wins += 1;
    player.streak = player.streak > 0 ? player.streak + 1 : 1;
    if (format === "singles") player.singlesWins += 1;
    else player.doublesWins += 1;
  } else {
    player.losses += 1;
    player.streak = player.streak < 0 ? player.streak - 1 : -1;
    if (format === "singles") player.singlesLosses += 1;
    else player.doublesLosses += 1;
  }
}

export function createSeedDatabase(): Database {
  const players: Player[] = SEED_PLAYERS.map((p) => ({
    id: randomUUID(),
    realName: p.realName,
    nickname: p.nickname,
    elo: STARTING_ELO,
    wins: 0,
    losses: 0,
    singlesWins: 0,
    singlesLosses: 0,
    doublesWins: 0,
    doublesLosses: 0,
    streak: 0,
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    lastPlayedAt: null,
  }));

  const byNick = new Map(players.map((p) => [p.nickname, p]));
  const games: Game[] = [];

  for (const match of SEED_MATCHES) {
    const sideA = match.a.map((n) => byNick.get(n)!);
    const sideB = match.b.map((n) => byNick.get(n)!);

    const wentToDeuce =
      match.wentToDeuce === true ||
      (match.scoreA !== null &&
        match.scoreB !== null &&
        Math.min(match.scoreA, match.scoreB) >= 10 &&
        Math.abs(match.scoreA - match.scoreB) === 2);

    const winner: "A" | "B" =
      match.winner ??
      (match.scoreA !== null && match.scoreB !== null && match.scoreA > match.scoreB
        ? "A"
        : "B");

    const { eloChanges, teamEloA, teamEloB } = applyMatchElo(
      sideA,
      sideB,
      winner,
      {
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        wentToDeuce,
      }
    );

    const playedAt = new Date();
    playedAt.setDate(playedAt.getDate() - match.daysAgo);
    playedAt.setHours(match.hour, 15 + (match.daysAgo % 3) * 7, 0, 0);
    const iso = playedAt.toISOString();

    const bump = (player: Player, won: boolean) => {
      player.lastPlayedAt = iso;
      applyResult(player, won, match.format);
    };

    for (const p of sideA) bump(p, winner === "A");
    for (const p of sideB) bump(p, winner === "B");

    games.push({
      id: randomUUID(),
      format: match.format,
      sideA: sideA.map((p) => p.id),
      sideB: sideB.map((p) => p.id),
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      winner,
      wentToDeuce,
      playedAt: iso,
      eloChanges,
      teamEloA: Math.round(teamEloA),
      teamEloB: Math.round(teamEloB),
    });
  }

  return { players, games };
}
