"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterBar, type FilterBarState } from "@/components/FilterBar";
import { MinGamesSlider } from "@/components/MinGamesSlider";
import { RatingChart } from "@/components/RatingChart";
import { exploreGames } from "@/lib/explore";
import { filterGames } from "@/lib/filters";
import {
  displayName,
  formatDelta,
  formatScoreline,
} from "@/lib/format";
import type { Game, Player } from "@/lib/types";

type Tab = "overview" | "ratings" | "players" | "rivalries" | "upsets";
type PlayerSort =
  | "eloDelta"
  | "winRate"
  | "games"
  | "avgMargin"
  | "name";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3.5">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export function AnalyticsView() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [minGames, setMinGames] = useState(1);
  const [playerSort, setPlayerSort] = useState<PlayerSort>("eloDelta");
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
      .catch(() => setError("Could not load stats."));
  }, []);

  const filteredGames = useMemo(
    () => filterGames(games, filters),
    [games, filters]
  );

  const data = useMemo(
    () => exploreGames(players, filteredGames),
    [players, filteredGames]
  );

  const maxPlayerGames = useMemo(
    () => data.playerStats.reduce((m, p) => Math.max(m, p.games), 1),
    [data.playerStats]
  );

  const sortedPlayers = useMemo(() => {
    const list = data.playerStats.filter((p) => p.games >= minGames);
    return [...list].sort((a, b) => {
      switch (playerSort) {
        case "winRate":
          return b.winRate - a.winRate || b.games - a.games;
        case "games":
          return b.games - a.games;
        case "avgMargin":
          return (b.avgMargin ?? -1) - (a.avgMargin ?? -1);
        case "name":
          return a.player.nickname.localeCompare(b.player.nickname);
        default:
          return b.eloDelta - a.eloDelta || b.games - a.games;
      }
    });
  }, [data.playerStats, minGames, playerSort]);

  if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;
  if (!games.length && !players.length) {
    return <p className="text-sm text-[var(--muted)]">Loading...</p>;
  }

  const maxMarginCount = Math.max(...data.scoreMargins.map((m) => m.count), 1);

  return (
    <div className="space-y-5">
      <FilterBar
        players={players}
        value={filters}
        onChange={setFilters}
        showHeadToHead
        resultCount={data.totalGames}
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["overview", "Overview"],
            ["ratings", "Ratings"],
            ["players", "Players"],
            ["rivalries", "Rivalries"],
            ["upsets", "Upsets"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="chip"
            data-active={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Matches"
              value={String(data.totalGames)}
              hint={`${data.singlesGames} singles · ${data.doublesGames} doubles`}
            />
            <Stat
              label="Players in view"
              value={String(data.uniquePlayers)}
              hint={`${data.deuceGames} deuce results`}
            />
            <Stat
              label="Avg margin"
              value={
                data.avgScoreMargin !== null
                  ? data.avgScoreMargin.toFixed(1)
                  : "-"
              }
              hint={`${data.thrillers} thrillers · ${data.blowouts} blowouts`}
            />
            <Stat
              label="Top ELO swing"
              value={
                data.eloSwingGames[0]
                  ? String(data.eloSwingGames[0].swing)
                  : "-"
              }
              hint={data.eloSwingGames[0]?.label}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[var(--foreground)]">Score margin distribution</h3>
            {data.scoreMargins.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No exact scores in this filter (deuce-only logs have no margin).
              </p>
            ) : (
              <div className="space-y-1.5">
                {data.scoreMargins.map((m) => (
                  <div key={m.margin} className="flex items-center gap-3 text-sm">
                    <span className="w-10 text-[var(--muted)]">+{m.margin}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded bg-[var(--track)]">
                      <div
                        className="h-full rounded bg-[var(--cyan)]"
                        style={{
                          width: `${(m.count / maxMarginCount) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-[var(--muted)]">
                      {m.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[var(--foreground)]">Biggest ELO swings</h3>
            <ul className="divide-y divide-[var(--border)]">
              {data.eloSwingGames.slice(0, 5).map((row) => (
                <li
                  key={row.game.id}
                  className="flex justify-between gap-3 py-2 text-sm"
                >
                  <span className="text-[var(--foreground)]">{row.label}</span>
                  <span className="text-[var(--muted)]">
                    {formatScoreline(row.game)} · ±{row.swing}
                  </span>
                </li>
              ))}
              {data.eloSwingGames.length === 0 && (
                <li className="py-3 text-sm text-[var(--muted)]">No games yet.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {tab === "ratings" && (
        <RatingChart
          players={players}
          games={filteredGames}
          focusPlayerId={filters.playerId}
        />
      )}

      {tab === "players" && (
        <div className="space-y-4">
          <div className="space-y-4">
            <div className="w-full sm:max-w-xs">
              <MinGamesSlider
                id="stats-min-games"
                value={minGames}
                onChange={setMinGames}
                min={1}
                max={maxPlayerGames}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["eloDelta", "ELO Δ"],
                  ["winRate", "Win %"],
                  ["games", "Games"],
                  ["avgMargin", "Avg margin"],
                  ["name", "Name"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="chip"
                  data-active={playerSort === id}
                  onClick={() => setPlayerSort(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                  <th className="pb-2 pr-3 font-medium">Player</th>
                  <th className="pb-2 pr-3 font-medium">G</th>
                  <th className="pb-2 pr-3 font-medium">W-L</th>
                  <th className="pb-2 pr-3 font-medium">Win%</th>
                  <th className="pb-2 pr-3 font-medium">ELO Δ</th>
                  <th className="pb-2 pr-3 font-medium">Avg mgn</th>
                  <th className="pb-2 pr-3 font-medium">Deuce</th>
                  <th className="pb-2 font-medium">S/D</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((row) => (
                  <tr
                    key={row.player.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="py-2.5 pr-3 font-medium text-[var(--foreground)]">
                      {displayName(row.player)}
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--muted)]">{row.games}</td>
                    <td className="py-2.5 pr-3 text-[var(--muted)]">
                      {row.wins}-{row.losses}
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--muted)]">
                      {Math.round(row.winRate * 100)}%
                    </td>
                    <td
                      className={`py-2.5 pr-3 font-medium ${
                        row.eloDelta > 0
                          ? "text-[var(--lime)]"
                          : row.eloDelta < 0
                            ? "text-[var(--magenta)]"
                            : "text-[var(--muted)]"
                      }`}
                    >
                      {formatDelta(row.eloDelta)}
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--muted)]">
                      {row.avgMargin !== null ? row.avgMargin.toFixed(1) : "-"}
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--muted)]">
                      {row.deuceGames}
                    </td>
                    <td className="py-2.5 text-[var(--muted)]">
                      {row.singles}/{row.doubles}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedPlayers.length === 0 && (
              <p className="py-8 text-center text-sm text-[var(--muted)]">
                No players meet the min games filter.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "rivalries" && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--muted)]">
            Matchups with 2+ games in the current filter.
          </p>
          <ul className="divide-y divide-[var(--border)]">
            {data.rivalries.map((r) => (
              <li
                key={r.key}
                className="flex flex-wrap items-baseline justify-between gap-2 py-3"
              >
                <span className="text-sm font-medium text-[var(--foreground)]">{r.label}</span>
                <span className="text-sm text-[var(--muted)]">
                  {r.games} games · {r.aWins}-{r.bWins}
                  {r.games > 0 && (
                    <>
                      {" "}
                      · {Math.round((Math.max(r.aWins, r.bWins) / r.games) * 100)}%
                      top side
                    </>
                  )}
                </span>
              </li>
            ))}
            {data.rivalries.length === 0 && (
              <li className="py-8 text-center text-sm text-[var(--muted)]">
                No repeat matchups in this filter.
              </li>
            )}
          </ul>
        </div>
      )}

      {tab === "upsets" && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--muted)]">
            Wins where the winner&apos;s side was underdog by 100+ pre-match ELO.
          </p>
          <ul className="divide-y divide-[var(--border)]">
            {data.upsets.map((u) => (
              <li key={u.game.id} className="py-3">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {u.winners}{" "}
                  <span className="font-normal text-[var(--muted)]">over</span>{" "}
                  {u.losers}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Underdog by {Math.round(u.eloGap)} · {formatScoreline(u.game)} ·{" "}
                  {u.game.format}
                  {u.game.wentToDeuce ? " · deuce" : ""}
                </p>
              </li>
            ))}
            {data.upsets.length === 0 && (
              <li className="py-8 text-center text-sm text-[var(--muted)]">
                No 100+ ELO upsets in this filter.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
