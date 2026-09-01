-- Rate My Pong schema (Neon / Postgres)
-- Run once in the Neon SQL editor, or it auto-runs on first API request.

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
);

CREATE UNIQUE INDEX IF NOT EXISTS players_nickname_lower_idx
  ON players (LOWER(nickname));

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  format TEXT NOT NULL CHECK (format IN ('singles', 'doubles')),
  side_a TEXT[] NOT NULL,
  side_b TEXT[] NOT NULL,
  score_a INTEGER,
  score_b INTEGER,
  winner TEXT NOT NULL CHECK (winner IN ('A', 'B')),
  went_to_deuce BOOLEAN NOT NULL DEFAULT FALSE,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  elo_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  team_elo_a INTEGER NOT NULL,
  team_elo_b INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS games_played_at_idx ON games (played_at DESC);
