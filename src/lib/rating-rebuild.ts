import { applyMatchElo, STARTING_ELO } from "./elo";
import type { Game, Player } from "./types";

function blankStats(player: Player): Player {
  return {
    ...player,
    elo: STARTING_ELO,
    wins: 0,
    losses: 0,
    singlesWins: 0,
    singlesLosses: 0,
    doublesWins: 0,
    doublesLosses: 0,
    streak: 0,
    lastPlayedAt: null,
  };
}

function applyResult(player: Player, won: boolean, format: Game["format"]) {
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

function reverseResult(player: Player, won: boolean, format: Game["format"]) {
  if (won) {
    player.wins = Math.max(0, player.wins - 1);
    if (format === "singles") {
      player.singlesWins = Math.max(0, player.singlesWins - 1);
    } else {
      player.doublesWins = Math.max(0, player.doublesWins - 1);
    }
  } else {
    player.losses = Math.max(0, player.losses - 1);
    if (format === "singles") {
      player.singlesLosses = Math.max(0, player.singlesLosses - 1);
    } else {
      player.doublesLosses = Math.max(0, player.doublesLosses - 1);
    }
  }
}

function playerWon(game: Game, playerId: string): boolean {
  if (game.sideA.includes(playerId)) return game.winner === "A";
  if (game.sideB.includes(playerId)) return game.winner === "B";
  return false;
}

function chronoAsc(games: Game[]): Game[] {
  return [...games].sort(
    (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
  );
}

/** Apply a stored snapshot path (old formula preserved). Mutates players. */
function applyStoredElo(game: Game, byId: Map<string, Player>) {
  for (const id of [...game.sideA, ...game.sideB]) {
    const player = byId.get(id);
    const snap = game.eloChanges[id];
    if (!player || !snap) continue;
    player.elo = snap.after;
  }
}

/** Recompute Elo with current formula. Mutates players + game.eloChanges. */
function recomputeElo(game: Game, byId: Map<string, Player>) {
  const playersA = game.sideA.map((id) => byId.get(id)!);
  const playersB = game.sideB.map((id) => byId.get(id)!);
  if (playersA.some((p) => !p) || playersB.some((p) => !p)) {
    throw new Error(`Missing player in game ${game.id}`);
  }
  const { eloChanges, teamEloA, teamEloB } = applyMatchElo(
    playersA,
    playersB,
    game.winner,
    {
      scoreA: game.scoreA,
      scoreB: game.scoreB,
      wentToDeuce: game.wentToDeuce,
    }
  );
  game.eloChanges = eloChanges;
  game.teamEloA = Math.round(teamEloA);
  game.teamEloB = Math.round(teamEloB);
}

function applyOutcomes(game: Game, byId: Map<string, Player>) {
  for (const id of game.sideA) {
    const p = byId.get(id);
    if (p) {
      p.lastPlayedAt = game.playedAt;
      applyResult(p, game.winner === "A", game.format);
    }
  }
  for (const id of game.sideB) {
    const p = byId.get(id);
    if (p) {
      p.lastPlayedAt = game.playedAt;
      applyResult(p, game.winner === "B", game.format);
    }
  }
}

/**
 * Rebuild player boards + selective game snapshots.
 * Games before `fromGameId` keep stored Elo deltas (old formula).
 * From that game onward, any game that touches `seedTouched` (or anyone
 * later pulled into the cascade) is recomputed with the current formula.
 * Other later games keep their stored deltas.
 */
export function hybridReplayFromGame(options: {
  players: Player[];
  games: Game[];
  fromGameId: string;
  /** Player ids whose post-edit path must be recomputed (grows by cascade). */
  seedTouched: string[];
  /** Optional mutate of the from-game before replay (e.g. swap opponent). */
  patchFromGame?: (game: Game) => void;
}): { players: Player[]; games: Game[]; recomputedGameIds: string[] } {
  const { fromGameId, seedTouched, patchFromGame } = options;
  const ordered = chronoAsc(options.games);
  const fromIndex = ordered.findIndex((g) => g.id === fromGameId);
  if (fromIndex < 0) {
    throw new Error(`Game ${fromGameId} not found.`);
  }

  const byId = new Map(options.players.map((p) => [p.id, blankStats(p)]));
  const gamesOut = ordered.map((g) => ({
    ...g,
    sideA: [...g.sideA],
    sideB: [...g.sideB],
    eloChanges: { ...g.eloChanges },
  }));

  if (patchFromGame) {
    patchFromGame(gamesOut[fromIndex]);
  }

  const touched = new Set(seedTouched);
  const recomputedGameIds: string[] = [];

  for (let i = 0; i < gamesOut.length; i++) {
    const game = gamesOut[i];
    const participants = [...game.sideA, ...game.sideB];

    if (i < fromIndex) {
      applyStoredElo(game, byId);
    } else {
      const hitsTouched = participants.some((id) => touched.has(id));
      if (hitsTouched || game.id === fromGameId) {
        recomputeElo(game, byId);
        for (const id of participants) touched.add(id);
        recomputedGameIds.push(game.id);
      } else {
        applyStoredElo(game, byId);
      }
    }

    applyOutcomes(game, byId);
  }

  return {
    players: [...byId.values()],
    games: gamesOut,
    recomputedGameIds,
  };
}

/** Reverse one game’s Elo + W/L using stored snapshots. Mutates players. */
export function reverseGameSnapshots(game: Game, byId: Map<string, Player>) {
  for (const id of [...game.sideA, ...game.sideB]) {
    const player = byId.get(id);
    if (!player) continue;
    const snap = game.eloChanges[id];
    if (snap) player.elo = snap.before;
    reverseResult(player, playerWon(game, id), game.format);
  }
}

/** Recompute streak + lastPlayedAt for players from remaining games. */
export function refreshDerivedStats(
  playerIds: string[],
  players: Map<string, Player>,
  remainingGames: Game[]
) {
  const ordered = chronoAsc(remainingGames);
  for (const id of playerIds) {
    const player = players.get(id);
    if (!player) continue;
    player.streak = 0;
    player.lastPlayedAt = null;
    for (const g of ordered) {
      if (!g.sideA.includes(id) && !g.sideB.includes(id)) continue;
      player.lastPlayedAt = g.playedAt;
      const won = playerWon(g, id);
      player.streak = won
        ? player.streak > 0
          ? player.streak + 1
          : 1
        : player.streak < 0
          ? player.streak - 1
          : -1;
    }
  }
}
