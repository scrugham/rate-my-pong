import { formatScoreline } from "./format";
import { sideLabel } from "./filters";
import type { Game, Player } from "./types";

/** Max gap between consecutive logs to count as one session. */
export const UNDO_SESSION_GAP_MS = 2 * 60 * 1000;
/** How long after the newest game in a session you can still undo it. */
export const UNDO_WINDOW_MS = 10 * 60 * 1000;

export interface UndoSessionGame {
  id: string;
  label: string;
  scoreline: string;
  format: Game["format"];
  playedAt: string;
}

export interface UndoSessionPreview {
  games: UndoSessionGame[];
  /** ISO time when the undo window expires. */
  expiresAt: string;
  remainingMs: number;
}

function chronoDesc(games: Game[]): Game[] {
  return [...games].sort(
    (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
  );
}

/** Newest-first session that is still inside the undo window. */
export function findUndoableSession(
  games: Game[],
  nowMs: number = Date.now()
): Game[] {
  const newestFirst = chronoDesc(games);
  if (newestFirst.length === 0) return [];

  const newest = newestFirst[0];
  const newestAt = new Date(newest.playedAt).getTime();
  if (nowMs - newestAt > UNDO_WINDOW_MS) return [];

  const session: Game[] = [newest];
  for (let i = 1; i < newestFirst.length; i++) {
    const older = newestFirst[i];
    const newer = session[session.length - 1];
    const gap =
      new Date(newer.playedAt).getTime() - new Date(older.playedAt).getTime();
    if (gap > UNDO_SESSION_GAP_MS) break;
    session.push(older);
  }
  return session;
}

export function previewUndoSession(
  games: Game[],
  players: Player[],
  nowMs: number = Date.now()
): UndoSessionPreview | null {
  const session = findUndoableSession(games, nowMs);
  if (session.length === 0) return null;

  const byId = new Map(players.map((p) => [p.id, p]));
  const newestAt = new Date(session[0].playedAt).getTime();
  const expiresAtMs = newestAt + UNDO_WINDOW_MS;
  const remainingMs = Math.max(0, expiresAtMs - nowMs);

  return {
    games: session.map((g) => ({
      id: g.id,
      label: `${sideLabel(g.sideA, byId)} vs ${sideLabel(g.sideB, byId)}`,
      scoreline: formatScoreline(g),
      format: g.format,
      playedAt: g.playedAt,
    })),
    expiresAt: new Date(expiresAtMs).toISOString(),
    remainingMs,
  };
}

/**
 * Validates a client undo request: must be the newest N games of the
 * current undoable session (N >= 1), in newest-first order.
 */
export function resolveUndoSelection(
  allGames: Game[],
  requestedIds: string[],
  nowMs: number = Date.now()
): Game[] {
  if (!requestedIds.length) {
    throw new Error("Pick at least one game to undo.");
  }

  const session = findUndoableSession(allGames, nowMs);
  if (session.length === 0) {
    throw new Error(
      "Nothing left to undo. The undo window may have expired, or a newer game was logged."
    );
  }

  if (requestedIds.length > session.length) {
    throw new Error("Those games are no longer in the undoable session.");
  }

  for (let i = 0; i < requestedIds.length; i++) {
    if (requestedIds[i] !== session[i].id) {
      throw new Error(
        "Undo must start from the newest game and go backward in order."
      );
    }
  }

  return session.slice(0, requestedIds.length);
}
