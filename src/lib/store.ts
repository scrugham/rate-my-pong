import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { applyMatchElo, assertValidSides, STARTING_ELO } from "./elo";
import {
  hasDatabaseUrl,
  pgDeleteGame,
  pgGetDatabase,
  pgGetPlayersByIds,
  pgInsertFeedback,
  pgInsertGame,
  pgInsertPlayer,
  pgListFeedback,
  pgListGames,
  pgListPlayers,
  pgNicknameTaken,
  pgUpdateGame,
  pgUpdatePlayer,
} from "./postgres";
import {
  hybridReplayFromGame,
  refreshDerivedStats,
  reverseGameSnapshots,
} from "./rating-rebuild";
import { createSeedDatabase } from "./seed";
import {
  previewUndoSession,
  resolveUndoSelection,
  type UndoSessionPreview,
} from "./undo-session";
import type {
  CreateFeedbackInput,
  CreateGameInput,
  CreatePlayerInput,
  Database,
  Feedback,
  Game,
  Player,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

async function ensureFileDb(): Promise<Database> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    return JSON.parse(raw) as Database;
  } catch {
    const seed = createSeedDatabase();
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
}

async function writeFileDb(db: Database): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function shouldUsePostgres(): boolean {
  return hasDatabaseUrl();
}

export async function getDatabase(): Promise<Database> {
  if (shouldUsePostgres()) return pgGetDatabase();
  return ensureFileDb();
}

export async function listPlayers(): Promise<Player[]> {
  if (shouldUsePostgres()) return pgListPlayers();
  const db = await ensureFileDb();
  return [...db.players].sort(
    (a, b) => b.elo - a.elo || a.nickname.localeCompare(b.nickname)
  );
}

export async function listGames(): Promise<Game[]> {
  if (shouldUsePostgres()) return pgListGames();
  const db = await ensureFileDb();
  return [...db.games].sort(
    (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
  );
}

export async function createPlayer(input: CreatePlayerInput): Promise<Player> {
  const realName = input.realName.trim();
  const nickname = input.nickname.trim();
  if (!realName || !nickname) {
    throw new Error("Nickname and real name are required.");
  }

  const player: Player = {
    id: randomUUID(),
    realName,
    nickname,
    elo: STARTING_ELO,
    wins: 0,
    losses: 0,
    singlesWins: 0,
    singlesLosses: 0,
    doublesWins: 0,
    doublesLosses: 0,
    streak: 0,
    createdAt: new Date().toISOString(),
    lastPlayedAt: null,
  };

  if (shouldUsePostgres()) {
    if (await pgNicknameTaken(nickname)) {
      throw new Error("That nickname is already taken. Pick another.");
    }
    await pgInsertPlayer(player);
    return player;
  }

  const db = await ensureFileDb();
  const nickTaken = db.players.some(
    (p) => p.nickname.toLowerCase() === nickname.toLowerCase()
  );
  if (nickTaken) {
    throw new Error("That nickname is already taken. Pick another.");
  }
  db.players.push(player);
  await writeFileDb(db);
  return player;
}

function applyResult(player: Player, won: boolean, format: "singles" | "doubles") {
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

function resolveWinnerAndScores(input: CreateGameInput): {
  winner: "A" | "B";
  scoreA: number | null;
  scoreB: number | null;
  wentToDeuce: boolean;
} {
  const { scoreMode } = input;

  if (scoreMode === "deuce") {
    if (input.winner !== "A" && input.winner !== "B") {
      throw new Error("Pick which side won the deuce.");
    }
    return {
      winner: input.winner,
      scoreA: null,
      scoreB: null,
      wentToDeuce: true,
    };
  }

  const a = Number(input.scoreA);
  const b = Number(input.scoreB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error("Scores must be numbers.");
  }
  if (a < 0 || b < 0) {
    throw new Error("Scores cannot be negative.");
  }
  if (a === b) {
    throw new Error("Ties are not allowed - play it out, or log as Won on deuce.");
  }

  return {
    winner: a > b ? "A" : "B",
    scoreA: a,
    scoreB: b,
    wentToDeuce: Math.min(a, b) >= 10 && Math.abs(a - b) === 2,
  };
}

export async function createGame(input: CreateGameInput): Promise<Game> {
  const { format, sideA, sideB } = input;
  assertValidSides(format, sideA, sideB);
  const { winner, scoreA, scoreB, wentToDeuce } = resolveWinnerAndScores(input);

  let playersA: Player[];
  let playersB: Player[];

  if (shouldUsePostgres()) {
    const allIds = [...sideA, ...sideB];
    const found = await pgGetPlayersByIds(allIds);
    const byId = new Map(found.map((p) => [p.id, p]));
    if (found.length !== new Set(allIds).size) {
      throw new Error("One or more players were not found.");
    }
    playersA = sideA.map((id) => byId.get(id)!);
    playersB = sideB.map((id) => byId.get(id)!);
  } else {
    const db = await ensureFileDb();
    const byId = new Map(db.players.map((p) => [p.id, p]));
    const resolve = (ids: string[]) =>
      ids.map((id) => {
        const p = byId.get(id);
        if (!p) throw new Error("One or more players were not found.");
        return p;
      });
    playersA = resolve(sideA);
    playersB = resolve(sideB);
  }

  const { eloChanges, teamEloA, teamEloB } = applyMatchElo(
    playersA,
    playersB,
    winner,
    { scoreA, scoreB, wentToDeuce }
  );
  const playedAt = new Date().toISOString();

  const bump = (player: Player, won: boolean) => {
    player.lastPlayedAt = playedAt;
    applyResult(player, won, format);
  };

  for (const p of playersA) bump(p, winner === "A");
  for (const p of playersB) bump(p, winner === "B");

  const game: Game = {
    id: randomUUID(),
    format,
    sideA,
    sideB,
    scoreA,
    scoreB,
    winner,
    wentToDeuce,
    playedAt,
    eloChanges,
    teamEloA: Math.round(teamEloA),
    teamEloB: Math.round(teamEloB),
  };

  if (shouldUsePostgres()) {
    for (const p of [...playersA, ...playersB]) {
      await pgUpdatePlayer(p);
    }
    await pgInsertGame(game);
    return game;
  }

  const db = await ensureFileDb();
  const byId = new Map(db.players.map((p) => [p.id, p]));
  for (const updated of [...playersA, ...playersB]) {
    byId.set(updated.id, updated);
  }
  db.players = [...byId.values()];
  db.games.push(game);
  await writeFileDb(db);
  return game;
}

export async function getUndoSessionPreview(): Promise<UndoSessionPreview | null> {
  const [games, players] = await Promise.all([listGames(), listPlayers()]);
  return previewUndoSession(games, players);
}

export async function undoRecentGames(gameIds: string[]): Promise<{
  undone: Game[];
  preview: UndoSessionPreview | null;
}> {
  const ids = gameIds.map(String);
  const games = await listGames();
  const toUndo = resolveUndoSelection(games, ids);

  if (shouldUsePostgres()) {
    const players = await pgListPlayers();
    const byId = new Map(players.map((p) => [p.id, { ...p }]));
    const affected = new Set<string>();

    for (const game of toUndo) {
      for (const id of [...game.sideA, ...game.sideB]) affected.add(id);
      reverseGameSnapshots(game, byId);
      await pgDeleteGame(game.id);
    }

    const remaining = games.filter((g) => !toUndo.some((u) => u.id === g.id));
    refreshDerivedStats([...affected], byId, remaining);

    for (const id of affected) {
      const p = byId.get(id);
      if (p) await pgUpdatePlayer(p);
    }

    const preview = previewUndoSession(remaining, [...byId.values()]);
    return { undone: toUndo, preview };
  }

  const db = await ensureFileDb();
  const byId = new Map(db.players.map((p) => [p.id, p]));
  const affected = new Set<string>();
  const undoIds = new Set(toUndo.map((g) => g.id));

  for (const game of toUndo) {
    for (const id of [...game.sideA, ...game.sideB]) affected.add(id);
    reverseGameSnapshots(game, byId);
  }

  db.games = db.games.filter((g) => !undoIds.has(g.id));
  refreshDerivedStats([...affected], byId, db.games);
  db.players = [...byId.values()];
  await writeFileDb(db);

  const preview = previewUndoSession(db.games, db.players);
  return { undone: toUndo, preview };
}

/**
 * Correct one logged game (sides/score) and hybrid-rebuild from that point.
 * Pre-game history keeps stored Elo deltas. From the edit onward, games that
 * touch the seed players (and anyone they cascade into) are recomputed.
 */
export async function repairGameHybrid(options: {
  gameId: string;
  sideA: string[];
  sideB: string[];
  scoreA: number | null;
  scoreB: number | null;
  winner: "A" | "B";
  wentToDeuce?: boolean;
  seedTouched?: string[];
}): Promise<{ recomputedGameIds: string[]; game: Game }> {
  const db = shouldUsePostgres()
    ? await pgGetDatabase()
    : await ensureFileDb();

  const target = db.games.find((g) => g.id === options.gameId);
  if (!target) throw new Error(`Game ${options.gameId} not found.`);

  const seedTouched = options.seedTouched?.length
    ? options.seedTouched
    : [...new Set([...target.sideA, ...target.sideB, ...options.sideA, ...options.sideB])];

  const { players, games, recomputedGameIds } = hybridReplayFromGame({
    players: db.players,
    games: db.games,
    fromGameId: options.gameId,
    seedTouched,
    patchFromGame: (game) => {
      game.sideA = [...options.sideA];
      game.sideB = [...options.sideB];
      game.scoreA = options.scoreA;
      game.scoreB = options.scoreB;
      game.winner = options.winner;
      game.wentToDeuce =
        options.wentToDeuce ??
        (options.scoreA !== null &&
          options.scoreB !== null &&
          Math.min(options.scoreA, options.scoreB) >= 10 &&
          Math.abs(options.scoreA - options.scoreB) === 2);
    },
  });

  const byIdBefore = new Map(db.games.map((g) => [g.id, g]));
  const changedGames = games.filter((g) => {
    const prev = byIdBefore.get(g.id);
    if (!prev) return true;
    return (
      recomputedGameIds.includes(g.id) ||
      prev.sideA.join() !== g.sideA.join() ||
      prev.sideB.join() !== g.sideB.join() ||
      prev.scoreA !== g.scoreA ||
      prev.scoreB !== g.scoreB ||
      prev.winner !== g.winner
    );
  });

  if (shouldUsePostgres()) {
    for (const p of players) await pgUpdatePlayer(p);
    for (const g of changedGames) await pgUpdateGame(g);
  } else {
    db.players = players;
    db.games = games;
    await writeFileDb(db);
  }

  const game = games.find((g) => g.id === options.gameId)!;
  return { recomputedGameIds, game };
}

const FEEDBACK_MAX_LEN = 2000;

export async function listFeedback(): Promise<Feedback[]> {
  if (shouldUsePostgres()) return pgListFeedback();
  const db = await ensureFileDb();
  const items = db.feedback ?? [];
  return [...items].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function createFeedback(
  input: CreateFeedbackInput
): Promise<Feedback> {
  const message = input.message.trim();
  if (!message) {
    throw new Error("Message is required.");
  }
  if (message.length > FEEDBACK_MAX_LEN) {
    throw new Error(`Message must be ${FEEDBACK_MAX_LEN} characters or fewer.`);
  }

  const nameRaw = input.name?.trim() ?? "";
  const name = nameRaw ? nameRaw.slice(0, 64) : null;

  const item: Feedback = {
    id: randomUUID(),
    message,
    name,
    createdAt: new Date().toISOString(),
  };

  if (shouldUsePostgres()) {
    await pgInsertFeedback(item);
    return item;
  }

  const db = await ensureFileDb();
  if (!db.feedback) db.feedback = [];
  db.feedback.push(item);
  await writeFileDb(db);
  return item;
}
