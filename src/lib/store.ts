import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { applyMatchElo, assertValidSides, STARTING_ELO } from "./elo";
import {
  hasDatabaseUrl,
  pgGetDatabase,
  pgGetPlayersByIds,
  pgInsertGame,
  pgInsertPlayer,
  pgListGames,
  pgListPlayers,
  pgNicknameTaken,
  pgUpdatePlayer,
} from "./postgres";
import { createSeedDatabase } from "./seed";
import type {
  CreateGameInput,
  CreatePlayerInput,
  Database,
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
