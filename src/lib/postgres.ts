import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Database, Game, Player } from "./types";

let sqlClient: NeonQueryFunction<false, false> | null = null;
let schemaReady: Promise<void> | null = null;

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function sql() {
  if (!sqlClient) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) throw new Error("DATABASE_URL is not set.");
    sqlClient = neon(url);
  }
  return sqlClient;
}

type PlayerRow = {
  id: string;
  real_name: string;
  nickname: string;
  elo: number;
  wins: number;
  losses: number;
  singles_wins: number;
  singles_losses: number;
  doubles_wins: number;
  doubles_losses: number;
  streak: number;
  created_at: string;
  last_played_at: string | null;
};

type GameRow = {
  id: string;
  format: "singles" | "doubles";
  side_a: string[];
  side_b: string[];
  score_a: number | null;
  score_b: number | null;
  winner: "A" | "B";
  went_to_deuce: boolean;
  played_at: string;
  elo_changes: Game["eloChanges"];
  team_elo_a: number;
  team_elo_b: number;
};

function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    realName: row.real_name,
    nickname: row.nickname,
    elo: row.elo,
    wins: row.wins,
    losses: row.losses,
    singlesWins: row.singles_wins,
    singlesLosses: row.singles_losses,
    doublesWins: row.doubles_wins,
    doublesLosses: row.doubles_losses,
    streak: row.streak,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : new Date(row.created_at).toISOString(),
    lastPlayedAt: row.last_played_at
      ? typeof row.last_played_at === "string"
        ? row.last_played_at
        : new Date(row.last_played_at).toISOString()
      : null,
  };
}

function mapGame(row: GameRow): Game {
  return {
    id: row.id,
    format: row.format,
    sideA: row.side_a,
    sideB: row.side_b,
    scoreA: row.score_a,
    scoreB: row.score_b,
    winner: row.winner,
    wentToDeuce: row.went_to_deuce,
    playedAt:
      typeof row.played_at === "string"
        ? row.played_at
        : new Date(row.played_at).toISOString(),
    eloChanges: row.elo_changes ?? {},
    teamEloA: row.team_elo_a,
    teamEloB: row.team_elo_b,
  };
}

export async function ensurePostgresSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = sql();
      await db`
        CREATE TABLE IF NOT EXISTS players (
          id TEXT PRIMARY KEY,
          real_name TEXT NOT NULL,
          nickname TEXT NOT NULL,
          elo INTEGER NOT NULL DEFAULT 1000,
          wins INTEGER NOT NULL DEFAULT 0,
          losses INTEGER NOT NULL DEFAULT 0,
          singles_wins INTEGER NOT NULL DEFAULT 0,
          singles_losses INTEGER NOT NULL DEFAULT 0,
          doubles_wins INTEGER NOT NULL DEFAULT 0,
          doubles_losses INTEGER NOT NULL DEFAULT 0,
          streak INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_played_at TIMESTAMPTZ
        )
      `;
      await db`
        CREATE UNIQUE INDEX IF NOT EXISTS players_nickname_lower_idx
        ON players (LOWER(nickname))
      `;
      await db`
        CREATE TABLE IF NOT EXISTS games (
          id TEXT PRIMARY KEY,
          format TEXT NOT NULL,
          side_a TEXT[] NOT NULL,
          side_b TEXT[] NOT NULL,
          score_a INTEGER,
          score_b INTEGER,
          winner TEXT NOT NULL,
          went_to_deuce BOOLEAN NOT NULL DEFAULT FALSE,
          played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          elo_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
          team_elo_a INTEGER NOT NULL,
          team_elo_b INTEGER NOT NULL
        )
      `;
      await db`
        CREATE INDEX IF NOT EXISTS games_played_at_idx ON games (played_at DESC)
      `;
    })();
  }
  await schemaReady;
}

export async function pgGetDatabase(): Promise<Database> {
  await ensurePostgresSchema();
  const db = sql();
  const playerRows = (await db`SELECT * FROM players`) as PlayerRow[];
  const gameRows = (await db`SELECT * FROM games ORDER BY played_at DESC`) as GameRow[];
  return {
    players: playerRows.map(mapPlayer),
    games: gameRows.map(mapGame),
  };
}

export async function pgListPlayers(): Promise<Player[]> {
  await ensurePostgresSchema();
  const db = sql();
  const rows = (await db`
    SELECT * FROM players
    ORDER BY elo DESC, nickname ASC
  `) as PlayerRow[];
  return rows.map(mapPlayer);
}

export async function pgListGames(): Promise<Game[]> {
  await ensurePostgresSchema();
  const db = sql();
  const rows = (await db`
    SELECT * FROM games
    ORDER BY played_at DESC
  `) as GameRow[];
  return rows.map(mapGame);
}

export async function pgInsertPlayer(player: Player): Promise<void> {
  await ensurePostgresSchema();
  const db = sql();
  try {
    await db`
      INSERT INTO players (
        id, real_name, nickname, elo, wins, losses,
        singles_wins, singles_losses, doubles_wins, doubles_losses,
        streak, created_at, last_played_at
      ) VALUES (
        ${player.id},
        ${player.realName},
        ${player.nickname},
        ${player.elo},
        ${player.wins},
        ${player.losses},
        ${player.singlesWins},
        ${player.singlesLosses},
        ${player.doublesWins},
        ${player.doublesLosses},
        ${player.streak},
        ${player.createdAt},
        ${player.lastPlayedAt}
      )
    `;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("unique") || message.includes("23505")) {
      throw new Error("That nickname is already taken. Pick another.");
    }
    throw err;
  }
}

export async function pgNicknameTaken(nickname: string): Promise<boolean> {
  await ensurePostgresSchema();
  const db = sql();
  const rows = (await db`
    SELECT id FROM players WHERE LOWER(nickname) = LOWER(${nickname}) LIMIT 1
  `) as { id: string }[];
  return rows.length > 0;
}

export async function pgGetPlayersByIds(ids: string[]): Promise<Player[]> {
  await ensurePostgresSchema();
  if (ids.length === 0) return [];
  const db = sql();
  const rows = (await db`
    SELECT * FROM players WHERE id = ANY(${ids})
  `) as PlayerRow[];
  return rows.map(mapPlayer);
}

export async function pgUpdatePlayer(player: Player): Promise<void> {
  await ensurePostgresSchema();
  const db = sql();
  await db`
    UPDATE players SET
      elo = ${player.elo},
      wins = ${player.wins},
      losses = ${player.losses},
      singles_wins = ${player.singlesWins},
      singles_losses = ${player.singlesLosses},
      doubles_wins = ${player.doublesWins},
      doubles_losses = ${player.doublesLosses},
      streak = ${player.streak},
      last_played_at = ${player.lastPlayedAt}
    WHERE id = ${player.id}
  `;
}

export async function pgInsertGame(game: Game): Promise<void> {
  await ensurePostgresSchema();
  const db = sql();
  await db`
    INSERT INTO games (
      id, format, side_a, side_b, score_a, score_b, winner,
      went_to_deuce, played_at, elo_changes, team_elo_a, team_elo_b
    ) VALUES (
      ${game.id},
      ${game.format},
      ${game.sideA},
      ${game.sideB},
      ${game.scoreA},
      ${game.scoreB},
      ${game.winner},
      ${game.wentToDeuce},
      ${game.playedAt},
      ${JSON.parse(JSON.stringify(game.eloChanges))},
      ${game.teamEloA},
      ${game.teamEloB}
    )
  `;
}
