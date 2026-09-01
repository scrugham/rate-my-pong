"use client";

import type { Player } from "@/lib/types";
import type { DeuceFilter, FormatFilter } from "@/lib/filters";
import { PlayerPicker } from "@/components/PlayerPicker";

export interface FilterBarState {
  format: FormatFilter;
  playerId: string | null;
  vsPlayerId: string | null;
  deuce: DeuceFilter;
}

interface FilterBarProps {
  players: Player[];
  value: FilterBarState;
  onChange: (next: FilterBarState) => void;
  showHeadToHead?: boolean;
  resultCount?: number;
}

export function FilterBar({
  players,
  value,
  onChange,
  showHeadToHead = false,
  resultCount,
}: FilterBarProps) {
  const set = <K extends keyof FilterBarState>(key: K, v: FilterBarState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Filters
        </p>
        {typeof resultCount === "number" && (
          <p className="text-xs text-[var(--muted)]">{resultCount} matches</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "singles", "doubles"] as FormatFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            className="chip"
            data-active={value.format === f}
            onClick={() => set("format", f)}
          >
            {f === "all" ? "All formats" : f}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "deuce", "exact"] as DeuceFilter[]).map((d) => (
          <button
            key={d}
            type="button"
            className="chip"
            data-active={value.deuce === d}
            onClick={() => set("deuce", d)}
          >
            {d === "all" ? "Any result" : d === "deuce" ? "Deuce only" : "Exact score"}
          </button>
        ))}
      </div>

      <div className={`grid gap-3 ${showHeadToHead ? "sm:grid-cols-2" : ""}`}>
        <PlayerPicker
          label="Player"
          players={players}
          value={value.playerId}
          onChange={(id) => {
            const next: FilterBarState = { ...value, playerId: id };
            if (id && value.vsPlayerId === id) next.vsPlayerId = null;
            onChange(next);
          }}
          allowClear
          clearLabel="Anyone"
          placeholder="Search players..."
        />

        {showHeadToHead && (
          <PlayerPicker
            label="vs"
            players={players}
            value={value.vsPlayerId}
            onChange={(id) => set("vsPlayerId", id)}
            excludeIds={value.playerId ? [value.playerId] : []}
            allowClear
            clearLabel="Anyone"
            placeholder="Search opponent..."
          />
        )}
      </div>
    </div>
  );
}
