"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MinGamesSlider } from "@/components/MinGamesSlider";
import {
  displayName,
  formatStreak,
  formatWinRate,
  winRate,
} from "@/lib/format";
import { takeLastResult } from "@/lib/last-result";
import { usePrefersReducedMotion } from "@/lib/use-media";
import type { EloSnapshot, Player } from "@/lib/types";

type Board = "main" | "singles" | "doubles";

const FLASH_MS = 3200;
const SLIDE_MS = 1800;

function gamesOnBoard(player: Player, board: Board): number {
  if (board === "singles") return player.singlesWins + player.singlesLosses;
  if (board === "doubles") return player.doublesWins + player.doublesLosses;
  return player.wins + player.losses;
}

function recordOnBoard(
  player: Player,
  board: Board
): { wins: number; losses: number } {
  if (board === "singles") {
    return { wins: player.singlesWins, losses: player.singlesLosses };
  }
  if (board === "doubles") {
    return { wins: player.doublesWins, losses: player.doublesLosses };
  }
  return { wins: player.wins, losses: player.losses };
}

function countTo(
  el: HTMLElement,
  from: number,
  to: number,
  duration: number
): void {
  if (duration <= 0 || from === to) {
    el.textContent = String(to);
    return;
  }
  const started = performance.now();
  el.textContent = String(from);

  const step = (now: number) => {
    const t = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = String(Math.round(from + (to - from) * eased));
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = String(to);
  };

  requestAnimationFrame(step);
}

export function LeaderboardView() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [board, setBoard] = useState<Board>("main");
  const [minGames, setMinGames] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reduceMotion = usePrefersReducedMotion();
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const playedRef = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const [playersRes, analyticsRes] = await Promise.all([
          fetch("/api/players"),
          fetch("/api/analytics"),
        ]);
        const playersData = await playersRes.json();
        const analyticsData = await analyticsRes.json();
        setPlayers(playersData.players ?? []);
        const map: Record<string, number> = {};
        for (const d of analyticsData.analytics?.recentDeltas ?? []) {
          map[d.playerId] = d.delta7d;
        }
        setDeltas(map);
      } catch {
        setError("Could not load leaderboard.");
      }
    }
    load();
  }, []);

  const maxGames = useMemo(
    () => players.reduce((m, p) => Math.max(m, gamesOnBoard(p, board)), 0),
    [players, board]
  );

  const effectiveMinGames = Math.min(minGames, maxGames);

  const ranked = useMemo(() => {
    const list = players.filter((p) => {
      const games = gamesOnBoard(p, board);
      if (board !== "main" && games === 0) return false;
      return games >= effectiveMinGames;
    });

    return list.sort((a, b) => {
      if (board === "main") {
        return b.elo - a.elo || a.nickname.localeCompare(b.nickname);
      }

      const aRec = recordOnBoard(a, board);
      const bRec = recordOnBoard(b, board);
      const aGames = aRec.wins + aRec.losses;
      const bGames = bRec.wins + bRec.losses;
      const aRate = winRate(aRec.wins, aRec.losses);
      const bRate = winRate(bRec.wins, bRec.losses);

      return (
        bRate - aRate ||
        bGames - aGames ||
        b.elo - a.elo ||
        a.nickname.localeCompare(b.nickname)
      );
    });
  }, [players, board, effectiveMinGames]);

  /** Elo rank animation only makes sense on Main. */
  useEffect(() => {
    if (board !== "main") return;
    if (!players.length || playedRef.current) return;
    playedRef.current = true;

    const result = takeLastResult();
    if (!result) return;

    const rows = rowRefs.current;
    const changes: Record<string, EloSnapshot> = result.changes;
    const visible = ranked.filter((p) => rows.has(p.id));
    if (!visible.length) return;

    const tops = visible.map((p) => rows.get(p.id)!.offsetTop);

    const beforeOrder = [...visible].sort((a, b) => {
      const ae = changes[a.id]?.before ?? a.elo;
      const be = changes[b.id]?.before ?? b.elo;
      return be - ae || a.nickname.localeCompare(b.nickname);
    });
    const beforeIndex = new Map(beforeOrder.map((p, i) => [p.id, i]));
    const timers: number[] = [];

    visible.forEach((p, afterIdx) => {
      const el = rows.get(p.id);
      if (!el) return;

      const fromIdx = beforeIndex.get(p.id) ?? afterIdx;
      const dy = tops[fromIdx] - tops[afterIdx];

      if (!reduceMotion && Math.abs(dy) > 0.5) {
        el.animate(
          [
            { transform: `translateY(${dy}px)` },
            { transform: "translateY(0)" },
          ],
          { duration: SLIDE_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
      }

      const change = changes[p.id];
      if (!change) return;

      el.classList.add("is-updated");
      timers.push(
        window.setTimeout(() => el.classList.remove("is-updated"), FLASH_MS)
      );

      const pop = el.querySelector<HTMLElement>("[data-pop]");
      if (pop) {
        pop.textContent =
          change.delta > 0 ? `+${change.delta}` : String(change.delta);
        pop.dataset.dir = change.delta >= 0 ? "up" : "down";
        pop.classList.add("is-playing");
        timers.push(
          window.setTimeout(() => pop.classList.remove("is-playing"), FLASH_MS)
        );
      }

      const eloEl = el.querySelector<HTMLElement>("[data-elo]");
      if (eloEl) {
        countTo(
          eloEl,
          change.before,
          change.after,
          reduceMotion ? 0 : SLIDE_MS
        );
      }
    });

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [players, ranked, reduceMotion, board]);

  const sortHint =
    board === "main"
      ? "Ranked by Elo. Singles and doubles both update this number."
      : board === "singles"
        ? "Ranked by singles win %. Elo is shown for context only."
        : "Ranked by doubles win %. Elo is shown for context only.";

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["main", "Main"],
              ["singles", "Singles"],
              ["doubles", "Doubles"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="chip"
              data-active={board === id}
              onClick={() => setBoard(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="text-xs text-[var(--muted)]">{sortHint}</p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <MinGamesSlider
              id="leaderboard-min-games"
              value={effectiveMinGames}
              onChange={setMinGames}
              max={maxGames}
            />
          </div>
          <p className="text-xs text-[var(--muted)] sm:pb-1">
            {ranked.length} {ranked.length === 1 ? "player" : "players"}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <ul className="divide-y divide-[var(--border)]">
        {ranked.map((p, index) => {
          const rank = index + 1;
          const delta = deltas[p.id] ?? 0;
          const record = recordOnBoard(p, board);
          const rateLabel = formatWinRate(record.wins, record.losses);

          return (
            <li
              key={p.id}
              ref={(el) => {
                if (el) rowRefs.current.set(p.id, el);
                else rowRefs.current.delete(p.id);
              }}
              className="lb-row flex items-center gap-3 px-1 py-3.5"
            >
              <span
                className={`w-6 shrink-0 text-sm font-semibold ${
                  rank === 1
                    ? "text-[var(--gold)]"
                    : rank === 2
                      ? "text-[var(--slate)]"
                      : rank === 3
                        ? "text-[var(--teal)]"
                        : "font-medium text-[var(--muted)]"
                }`}
              >
                {rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--foreground)]">
                  {displayName(p)}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {board === "main" ? (
                    <>
                      {record.wins}-{record.losses} · {rateLabel} ·{" "}
                      {formatStreak(p.streak)}
                    </>
                  ) : (
                    <>
                      {record.wins}-{record.losses} · {rateLabel} · Elo {p.elo}
                    </>
                  )}
                </p>
              </div>
              <div className="text-right">
                {board === "main" ? (
                  <>
                    <p
                      className="lb-elo text-base font-semibold text-[var(--cyan)]"
                      data-elo
                    >
                      {p.elo}
                    </p>
                    <p
                      className={`text-xs ${
                        delta > 0
                          ? "text-[var(--lime)]"
                          : delta < 0
                            ? "text-[var(--magenta)]"
                            : "text-[var(--muted)]"
                      }`}
                    >
                      {delta > 0 ? `+${delta}` : delta} recent
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-semibold text-[var(--cyan)]">
                      {rateLabel}
                    </p>
                    <p className="text-xs text-[var(--muted)]">{p.elo} Elo</p>
                  </>
                )}
              </div>
              <span className="lb-pop" data-pop aria-hidden />
            </li>
          );
        })}
        {ranked.length === 0 && (
          <li className="py-10 text-center text-sm text-[var(--muted)]">
            {effectiveMinGames > 0
              ? `No players with ${effectiveMinGames}+ ${
                  board === "main" ? "" : `${board} `
                }games. Lower the min games slider.`
              : board === "main"
                ? "No players yet."
                : `No ${board} games logged yet.`}
          </li>
        )}
      </ul>
    </div>
  );
}
