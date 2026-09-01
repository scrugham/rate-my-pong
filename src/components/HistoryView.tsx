"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterBar, type FilterBarState } from "@/components/FilterBar";
import { filterGames, sideLabel } from "@/lib/filters";
import { formatDelta, formatScoreline } from "@/lib/format";
import type { Game, Player } from "@/lib/types";

type SortMode = "newest" | "oldest" | "swing";

export function HistoryView() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("newest");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [filters, setFilters] = useState<FilterBarState>({
    format: "all",
    playerId: null,
    vsPlayerId: null,
    deuce: "all",
  });

  useEffect(() => {
    Promise.all([fetch("/api/players"), fetch("/api/games")])
      .then(async ([pr, gr]) => {
        const pd = await pr.json();
        const gd = await gr.json();
        setPlayers(pd.players ?? []);
        setGames(gd.games ?? []);
      })
      .catch(() => setError("Could not load history."));
  }, []);

  const byId = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  const filtered = useMemo(() => {
    const list = filterGames(games, filters);
    const withSwing = list.map((g) => {
      const swings = Object.values(g.eloChanges).map((c) => Math.abs(c.delta));
      return { game: g, swing: swings.length ? Math.max(...swings) : 0 };
    });
    withSwing.sort((a, b) => {
      if (sort === "swing") return b.swing - a.swing;
      const at = new Date(a.game.playedAt).getTime();
      const bt = new Date(b.game.playedAt).getTime();
      return sort === "oldest" ? at - bt : bt - at;
    });
    return withSwing;
  }, [games, filters, sort]);

  function toggle(id: string) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;

  return (
    <div className="space-y-4">
      <FilterBar
        players={players}
        value={filters}
        onChange={setFilters}
        showHeadToHead
        resultCount={filtered.length}
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["newest", "Newest"],
            ["oldest", "Oldest"],
            ["swing", "Biggest ELO swing"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="chip"
            data-active={sort === id}
            onClick={() => setSort(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-[var(--border)]">
        {filtered.map(({ game: g, swing }) => {
          const a = sideLabel(g.sideA, byId);
          const b = sideLabel(g.sideB, byId);
          const winnerSide = g.winner === "A" ? a : b;
          const detail = `${g.format}${g.wentToDeuce ? " · deuce" : ""} · swing ${swing}`;
          const deltas = Object.entries(g.eloChanges)
            .map(([id, snap]) => {
              const nick = byId.get(id)?.nickname ?? "?";
              return `${nick} ${formatDelta(snap.delta)}`;
            })
            .join(" · ");
          const isOpen = expanded.has(g.id);

          return (
            <li key={g.id} className="py-3">
              <button
                type="button"
                className="history-row"
                aria-expanded={isOpen}
                onClick={() => toggle(g.id)}
              >
                <span className="block text-sm font-medium text-[var(--foreground)]">
                  {a} <span className="font-normal text-[var(--muted)]">vs</span>{" "}
                  {b}
                </span>

                <span className="mt-1 flex items-center justify-between gap-2">
                  <span className="min-w-0 text-sm text-[var(--muted)]">
                    <span className="font-medium text-[var(--foreground)]">
                      {formatScoreline(g)}
                    </span>
                    {" · "}
                    {winnerSide} won
                    <span className="hidden sm:inline"> · {detail}</span>
                  </span>
                  <span
                    className="history-caret sm:hidden"
                    data-open={isOpen}
                    aria-hidden
                  >
                    ▼
                  </span>
                </span>
              </button>

              <div className={isOpen ? "block" : "hidden sm:block"}>
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  <span className="sm:hidden">{detail} · </span>
                  {deltas}
                </p>
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="py-10 text-center text-sm text-[var(--muted)]">
            No matches for these filters.
          </li>
        )}
      </ul>
    </div>
  );
}
