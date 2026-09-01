"use client";

import type { SeriesGameDraft } from "@/lib/series";

interface SeriesGameRowEditorProps {
  game: SeriesGameDraft;
  labelA: string;
  labelB: string;
  onChange: (next: SeriesGameDraft) => void;
}

export function SeriesGameRowEditor({
  game,
  labelA,
  labelB,
  onChange,
}: SeriesGameRowEditorProps) {
  const set = <K extends keyof SeriesGameDraft>(
    key: K,
    value: SeriesGameDraft[K]
  ) => onChange({ ...game, [key]: value });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="chip"
          data-active={game.scoreMode === "exact"}
          onClick={() => set("scoreMode", "exact")}
        >
          Exact score
        </button>
        <button
          type="button"
          className="chip"
          data-active={game.scoreMode === "deuce"}
          onClick={() => set("scoreMode", "deuce")}
        >
          Won on deuce
        </button>
      </div>

      {game.scoreMode === "exact" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">{labelA}</span>
            <input
              className="field text-center text-xl font-semibold"
              inputMode="numeric"
              value={game.scoreA}
              onChange={(e) =>
                set("scoreA", e.target.value.replace(/[^\d]/g, ""))
              }
            />
          </label>
          <label>
            <span className="label">{labelB}</span>
            <input
              className="field text-center text-xl font-semibold"
              inputMode="numeric"
              value={game.scoreB}
              onChange={(e) =>
                set("scoreB", e.target.value.replace(/[^\d]/g, ""))
              }
              placeholder="0"
            />
          </label>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="deuce-pick"
            data-active={game.deuceWinner === "A"}
            onClick={() => set("deuceWinner", "A")}
          >
            {labelA} won
          </button>
          <button
            type="button"
            className="deuce-pick"
            data-active={game.deuceWinner === "B"}
            onClick={() => set("deuceWinner", "B")}
          >
            {labelB} won
          </button>
        </div>
      )}
    </div>
  );
}
