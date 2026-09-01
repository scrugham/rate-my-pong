import type { MatchFormat, Player } from "./types";
import type { EloSnapshot } from "./types";

export const STARTING_ELO = 1000;
export const K_FACTOR = 32;
export const K_PROVISIONAL = 64;
export const PROVISIONAL_GAMES = 10;
export const AUTOCORR_C = 2.5;
export const WEAKER_WEIGHT = 0.65;
export const STRONGER_WEIGHT = 0.35;

/** Closest contest multiplier (floor). 11–9 / deuce sits here. */
export const MARGIN_MIN = 0.82;
/** Blowout multiplier (cap). Symmetric ±0.18 around 11–6. */
export const MARGIN_MAX = 1.18;
/** Margin whose multiplier is 1.00 (11–6 in this league). */
export const AVERAGE_MARGIN = 5;
export const MARGIN_SLOPE = 0.06;
export const MARGIN_INTERCEPT = 1 - AVERAGE_MARGIN * MARGIN_SLOPE; // 0.70

export function expectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

export function kFactor(gamesPlayedBeforeMatch: number): number {
  return gamesPlayedBeforeMatch < PROVISIONAL_GAMES ? K_PROVISIONAL : K_FACTOR;
}

/** Singles: the player's Elo. Doubles: 65% weaker + 35% stronger. */
export function teamElo(players: Player[]): number {
  if (players.length === 0) return STARTING_ELO;
  if (players.length === 1) return players[0].elo;
  const sorted = [...players].sort((a, b) => a.elo - b.elo);
  const weaker = sorted[0].elo;
  const stronger = sorted[sorted.length - 1].elo;
  return weaker * WEAKER_WEIGHT + stronger * STRONGER_WEIGHT;
}

/**
 * 538-style margin-of-victory autocorrelation.
 * Favorite blowouts shrink; underdog wins inflate.
 * c = 2.5 stays positive until a ~1000-point upset.
 */
export function autocorrelation(
  winnerTeamElo: number,
  loserTeamElo: number
): number {
  return AUTOCORR_C / ((winnerTeamElo - loserTeamElo) / 400 + AUTOCORR_C);
}

/**
 * Scale how much ELO moves based on how decisive the match was.
 * Unknown deuce tallies are treated as margin 2 (minimum win-by-two).
 */
export function marginMultiplier(
  scoreA: number | null,
  scoreB: number | null,
  wentToDeuce: boolean
): number {
  let margin: number;

  if (scoreA === null || scoreB === null) {
    margin = wentToDeuce ? 2 : 4;
  } else {
    margin = Math.abs(scoreA - scoreB);
    if (wentToDeuce && margin < 2) margin = 2;
  }

  // margin 2 -> 0.82, margin 5 -> 1.00, margin 6 -> 1.06, margin 8+ -> 1.18
  const raw = MARGIN_INTERCEPT + margin * MARGIN_SLOPE;
  return Math.min(MARGIN_MAX, Math.max(MARGIN_MIN, raw));
}

/** Shared weight after MoV × autocorrelation × surprise. Apply each player's K next. */
export function matchWeight(
  winnerTeamElo: number,
  loserTeamElo: number,
  options?: {
    scoreA?: number | null;
    scoreB?: number | null;
    wentToDeuce?: boolean;
  }
): number {
  const expected = expectedScore(winnerTeamElo, loserTeamElo);
  const mov = marginMultiplier(
    options?.scoreA ?? null,
    options?.scoreB ?? null,
    options?.wentToDeuce ?? false
  );
  const auto = autocorrelation(winnerTeamElo, loserTeamElo);
  return mov * auto * (1 - expected);
}

export function ratingDelta(
  winnerTeamElo: number,
  loserTeamElo: number,
  options?: {
    k?: number;
    scoreA?: number | null;
    scoreB?: number | null;
    wentToDeuce?: boolean;
  }
): number {
  const k = options?.k ?? K_FACTOR;
  const weight = matchWeight(winnerTeamElo, loserTeamElo, options);
  return Math.max(1, Math.round(k * weight));
}

/** Mutates player.elo only. Caller applies win/loss counts after, so K sees pre-match games. */
export function applyMatchElo(
  playersA: Player[],
  playersB: Player[],
  winner: "A" | "B",
  options: {
    scoreA: number | null;
    scoreB: number | null;
    wentToDeuce: boolean;
  }
): {
  eloChanges: Record<string, EloSnapshot>;
  teamEloA: number;
  teamEloB: number;
} {
  const teamEloA = teamElo(playersA);
  const teamEloB = teamElo(playersB);
  const winnerTeam = winner === "A" ? teamEloA : teamEloB;
  const loserTeam = winner === "A" ? teamEloB : teamEloA;
  const weight = matchWeight(winnerTeam, loserTeam, options);

  const eloChanges: Record<string, EloSnapshot> = {};

  const bump = (player: Player, won: boolean) => {
    const k = kFactor(player.wins + player.losses);
    const delta = Math.max(1, Math.round(k * weight));
    const before = player.elo;
    const after = won ? before + delta : before - delta;
    player.elo = after;
    eloChanges[player.id] = {
      before,
      after,
      delta: after - before,
    };
  };

  for (const p of playersA) bump(p, winner === "A");
  for (const p of playersB) bump(p, winner === "B");

  return {
    eloChanges,
    teamEloA,
    teamEloB,
  };
}

export function assertValidSides(
  format: MatchFormat,
  sideA: string[],
  sideB: string[]
): void {
  const size = format === "singles" ? 1 : 2;
  if (sideA.length !== size || sideB.length !== size) {
    throw new Error(
      format === "singles"
        ? "Singles requires exactly one player per side."
        : "Doubles requires exactly two players per side."
    );
  }

  const all = [...sideA, ...sideB];
  if (new Set(all).size !== all.length) {
    throw new Error("A player cannot appear more than once in a match.");
  }
}
