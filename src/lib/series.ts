import type { EloSnapshot, ScoreMode } from "./types";

export interface SeriesGameDraft {
  id: string;
  scoreMode: ScoreMode;
  scoreA: string;
  scoreB: string;
  deuceWinner: "A" | "B" | null;
}

export function newGameDraft(): SeriesGameDraft {
  return {
    id: crypto.randomUUID(),
    scoreMode: "exact",
    scoreA: "11",
    scoreB: "",
    deuceWinner: null,
  };
}

export function gameWinner(game: SeriesGameDraft): "A" | "B" | null {
  if (game.scoreMode === "deuce") return game.deuceWinner;
  const a = Number(game.scoreA);
  const b = Number(game.scoreB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a === b) return null;
  return a > b ? "A" : "B";
}

export function seriesTally(games: SeriesGameDraft[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const g of games) {
    const w = gameWinner(g);
    if (w === "A") a += 1;
    if (w === "B") b += 1;
  }
  return { a, b };
}

export function validateGame(game: SeriesGameDraft): string | null {
  if (game.scoreMode === "deuce") {
    return game.deuceWinner ? null : "Pick a deuce winner.";
  }
  const a = Number(game.scoreA);
  const b = Number(game.scoreB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "Enter both scores.";
  if (a === b) return "Scores cannot tie.";
  return null;
}

/** Combine per-game Elo snapshots into one net change per player for the board animation. */
export function mergeEloChanges(
  acc: Record<string, EloSnapshot>,
  next: Record<string, EloSnapshot>
): Record<string, EloSnapshot> {
  const merged = { ...acc };
  for (const [id, snap] of Object.entries(next)) {
    if (merged[id]) {
      merged[id] = {
        before: merged[id].before,
        after: snap.after,
        delta: snap.after - merged[id].before,
      };
    } else {
      merged[id] = snap;
    }
  }
  return merged;
}
