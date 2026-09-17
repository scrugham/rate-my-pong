"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DataLoading } from "@/components/DataLoading";
import { PlayerPicker } from "@/components/PlayerPicker";
import { RatingChart } from "@/components/RatingChart";
import {
  analyzeCareer,
  analyzeH2H,
  type CareerAnalysis,
  type H2HAnalysis,
} from "@/lib/player-analysis";
import {
  displayName,
  formatDelta,
  formatStreak,
  formatWinRate,
} from "@/lib/format";
import type { Game, Player } from "@/lib/types";

function fmtAvg(n: number | null, digits = 1): string {
  if (n === null) return "-";
  return n.toFixed(digits);
}

function StatCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>
      )}
    </div>
  );
}

function OpponentList({
  title,
  rows,
  empty,
  onPick,
}: {
  title: string;
  rows: CareerAnalysis["bestOpponents"];
  empty: string;
  onPick: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--border)]">
          {rows.map((o) => (
            <li key={o.opponentId}>
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-3 py-2.5 text-left transition-colors hover:text-[var(--cyan)]"
                onClick={() => onPick(o.opponentId)}
              >
                <span className="truncate text-sm font-medium">
                  {o.nickname}
                </span>
                <span className="shrink-0 font-mono text-xs text-[var(--muted)]">
                  {o.wins}-{o.losses} · {Math.round(o.winRate * 100)}%
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface PlayerProfileViewProps {
  playerId: string;
}

export function PlayerProfileView({ playerId }: PlayerProfileViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vsId = searchParams.get("vs");

  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/players"), fetch("/api/games")])
      .then(async ([pr, gr]) => {
        const pd = await pr.json();
        const gd = await gr.json();
        setPlayers(pd.players ?? []);
        setGames(gd.games ?? []);
      })
      .catch(() => setError("Could not load player."))
      .finally(() => setReady(true));
  }, []);

  const player = useMemo(
    () => players.find((p) => p.id === playerId) ?? null,
    [players, playerId]
  );

  const vs = useMemo(
    () => (vsId ? players.find((p) => p.id === vsId) ?? null : null),
    [players, vsId]
  );

  const career = useMemo(
    () => (player ? analyzeCareer(player, players, games) : null),
    [player, players, games]
  );

  const h2h = useMemo(
    () =>
      player && vs ? analyzeH2H(player, vs, players, games) : null,
    [player, vs, players, games]
  );

  const setVs = useCallback(
    (id: string | null) => {
      const url = id
        ? `/player/${playerId}?vs=${encodeURIComponent(id)}`
        : `/player/${playerId}`;
      router.replace(url, { scroll: false });
    },
    [playerId, router]
  );

  async function copyLink() {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  if (error) {
    return <p className="text-sm text-[var(--danger)]">{error}</p>;
  }
  if (!ready) return <DataLoading />;
  if (!player || !career) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--muted)]">Player not found.</p>
        <Link href="/analytics" className="text-sm text-[var(--cyan)] underline">
          Back to Stats
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--cyan)]">
            Player
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
            {player.nickname}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{player.realName}</p>
          <p className="mt-3 font-mono text-sm text-[var(--muted)]">
            <span className="text-lg font-semibold text-[var(--cyan)]">
              {player.elo}
            </span>{" "}
            Elo · {career.wins}-{career.losses} · {formatStreak(player.streak)}
            {career.eloDeltaCareer !== 0 && (
              <>
                {" "}
                · career{" "}
                <span
                  className={
                    career.eloDeltaCareer > 0
                      ? "text-[var(--lime)]"
                      : "text-[var(--magenta)]"
                  }
                >
                  {formatDelta(career.eloDeltaCareer)}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="chip" onClick={copyLink}>
            {copied ? "Copied" : "Copy link"}
          </button>
          <Link href="/analytics" className="chip">
            Stats
          </Link>
          <Link href="/leaderboard" className="chip">
            Leaderboard
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--field-bg)] p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <PlayerPicker
              label="Compare with"
              players={players}
              value={vsId}
              onChange={setVs}
              excludeIds={[playerId]}
              allowClear
              clearLabel="Clear compare"
              placeholder="Pick an opponent"
            />
          </div>
        </div>
      </div>

      {h2h ? (
        <H2HBlock h2h={h2h} onClear={() => setVs(null)} />
      ) : (
        <CareerBlock
          career={career}
          onPickOpponent={setVs}
          players={players}
          games={games}
        />
      )}
    </div>
  );
}

function CareerBlock({
  career,
  onPickOpponent,
  players,
  games,
}: {
  career: CareerAnalysis;
  onPickOpponent: (id: string) => void;
  players: Player[];
  games: Game[];
}) {
  const scoredHint =
    career.scoredGames > 0
      ? `${career.scoredGames} scored game${career.scoredGames === 1 ? "" : "s"}`
      : "No exact scores yet";

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCell
          label="Win %"
          value={formatWinRate(career.wins, career.losses)}
        />
        <StatCell
          label="Points for"
          value={fmtAvg(career.avgPointsFor)}
          hint={scoredHint}
        />
        <StatCell
          label="Points against"
          value={fmtAvg(career.avgPointsAgainst)}
          hint={scoredHint}
        />
        <StatCell
          label="Margin"
          value={
            career.avgMargin === null
              ? "-"
              : formatDelta(Number(career.avgMargin.toFixed(1)))
          }
          hint={scoredHint}
        />
        <StatCell
          label="Singles"
          value={`${career.singlesWins}-${career.singlesLosses}`}
        />
        <StatCell
          label="Doubles"
          value={`${career.doublesWins}-${career.doublesLosses}`}
        />
      </div>

      {career.games > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Rating over time
          </h2>
          <div className="mt-3">
            <RatingChart
              players={players}
              games={games}
              focusPlayerId={career.player.id}
            />
          </div>
        </div>
      )}

      <div className="grid gap-8 sm:grid-cols-2">
        <OpponentList
          title="Best against"
          rows={career.bestOpponents}
          empty="Need 2+ meetings with someone to rank matchups."
          onPick={onPickOpponent}
        />
        <OpponentList
          title="Worst against"
          rows={career.worstOpponents}
          empty="Need 2+ meetings with someone to rank matchups."
          onPick={onPickOpponent}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Recent results
        </h3>
        {career.recent.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No games yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {career.recent.map((r) => (
              <li
                key={r.game.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm"
              >
                <span>
                  <span
                    className={
                      r.won ? "text-[var(--lime)]" : "text-[var(--magenta)]"
                    }
                  >
                    {r.won ? "W" : "L"}
                  </span>{" "}
                  vs {r.opponents} · {r.scoreline}
                </span>
                <span
                  className={`font-mono text-xs ${
                    r.eloDelta > 0
                      ? "text-[var(--lime)]"
                      : r.eloDelta < 0
                        ? "text-[var(--magenta)]"
                        : "text-[var(--muted)]"
                  }`}
                >
                  {formatDelta(r.eloDelta)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-[var(--muted)]">
        Deuce rate:{" "}
        {career.games
          ? `${Math.round((career.deuceGames / career.games) * 100)}%`
          : "-"}{" "}
        · Points for/against only count games logged with exact scores.
      </p>
    </div>
  );
}

function H2HBlock({
  h2h,
  onClear,
}: {
  h2h: H2HAnalysis;
  onClear: () => void;
}) {
  const scoredHint =
    h2h.scoredGames > 0
      ? `${h2h.scoredGames} scored`
      : "No exact scores in this series";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--cyan)]">
            Head to head
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {h2h.player.nickname}{" "}
            <span className="text-[var(--muted)]">vs</span> {h2h.vs.nickname}
          </h2>
          <p className="mt-2 font-mono text-sm text-[var(--muted)]">
            Series{" "}
            <span className="text-[var(--foreground)]">
              {h2h.playerWins}–{h2h.vsWins}
            </span>{" "}
            · {h2h.games} game{h2h.games === 1 ? "" : "s"}
          </p>
        </div>
        <button type="button" className="chip" onClick={onClear}>
          Clear compare
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCell
          label={`${h2h.player.nickname} Elo Δ`}
          value={formatDelta(h2h.playerEloDelta)}
        />
        <StatCell
          label={`${h2h.vs.nickname} Elo Δ`}
          value={formatDelta(h2h.vsEloDelta)}
        />
        <StatCell
          label={`${h2h.player.nickname} PF`}
          value={fmtAvg(h2h.avgPointsFor)}
          hint={scoredHint}
        />
        <StatCell
          label={`${h2h.player.nickname} PA`}
          value={fmtAvg(h2h.avgPointsAgainst)}
          hint={scoredHint}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Meetings
        </h3>
        {h2h.meetings.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            No games on opposite sides yet.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {h2h.meetings.map((m) => (
              <li
                key={m.game.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm"
              >
                <span>
                  <span
                    className={
                      m.playerWon
                        ? "text-[var(--lime)]"
                        : "text-[var(--magenta)]"
                    }
                  >
                    {m.playerWon ? "W" : "L"}
                  </span>{" "}
                  {m.scoreline} · {m.game.format}
                  {m.game.wentToDeuce ? " · deuce" : ""}
                </span>
                <span className="font-mono text-xs text-[var(--muted)]">
                  <span
                    className={
                      m.playerDelta > 0
                        ? "text-[var(--lime)]"
                        : m.playerDelta < 0
                          ? "text-[var(--magenta)]"
                          : undefined
                    }
                  >
                    {formatDelta(m.playerDelta)}
                  </span>
                  {" / "}
                  <span
                    className={
                      m.vsDelta > 0
                        ? "text-[var(--lime)]"
                        : m.vsDelta < 0
                          ? "text-[var(--magenta)]"
                          : undefined
                    }
                  >
                    {formatDelta(m.vsDelta)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-[var(--muted)]">
        Showing {displayName(h2h.player)} vs {displayName(h2h.vs)} when on
        opposite sides. Copy link includes this compare.
      </p>
    </div>
  );
}
