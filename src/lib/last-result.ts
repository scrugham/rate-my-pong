import type { EloSnapshot } from "./types";

export interface LastResult {
  at: number;
  changes: Record<string, EloSnapshot>;
}

const KEY = "rmp-last-result";

/** Older results are ignored so the board does not replay a stale animation. */
const MAX_AGE_MS = 3 * 60 * 1000;

export function saveLastResult(changes: Record<string, EloSnapshot>): void {
  try {
    const payload: LastResult = { at: Date.now(), changes };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

/** Reads and clears the pending result so it only animates once. */
export function takeLastResult(): LastResult | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as LastResult;
    if (!parsed?.changes || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}
