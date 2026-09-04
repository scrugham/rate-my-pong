"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { displayName } from "@/lib/format";
import { chronologicalGames, ratingSeriesForPlayers } from "@/lib/rating-history";
import { usePrefersReducedMotion } from "@/lib/use-media";
import type { Game, Player } from "@/lib/types";

const PALETTE = [
  "#00afd4",
  "#9abe26",
  "#b12373",
  "#f2a900",
  "#006683",
  "#7c8cff",
  "#ff7a59",
  "#3ecf8e",
  "#c77dff",
  "#4cc9f0",
  "#ef476f",
  "#06d6a0",
  "#ffd166",
  "#118ab2",
  "#f72585",
  "#90e0ef",
];

const MIN_WINDOW = 4;
const LABEL_GAP = 13;
const MONO =
  'ui-monospace, "Cascadia Mono", Consolas, "SF Mono", monospace';

function colorFor(playerId: string, orderedIds: string[]): string {
  const i = orderedIds.indexOf(playerId);
  return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
}

/** Stack end-label Y positions so nearby series don't overlap. */
function dodgeLabelYs(
  items: { y: number }[],
  minGap: number,
  top: number,
  bottom: number
): number[] {
  const order = items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => a.y - b.y);
  const ys = order.map((o) => o.y);
  for (let i = 1; i < ys.length; i++) {
    if (ys[i] - ys[i - 1] < minGap) ys[i] = ys[i - 1] + minGap;
  }
  if (ys.length && ys[ys.length - 1] > bottom) {
    let overflow = ys[ys.length - 1] - bottom;
    for (let i = ys.length - 1; i >= 0 && overflow > 0; i--) {
      const floor = i === 0 ? top : ys[i - 1] + minGap;
      const pull = Math.min(overflow, Math.max(0, ys[i] - floor));
      ys[i] -= pull;
      overflow -= pull;
    }
  }
  const out = new Array<number>(items.length);
  order.forEach((o, i) => {
    out[o.index] = ys[i];
  });
  return out;
}

interface RatingChartProps {
  players: Player[];
  games: Game[];
  /** Pre-select this player when set. */
  focusPlayerId?: string | null;
}

export function RatingChart({
  players,
  games,
  focusPlayerId = null,
}: RatingChartProps) {
  const ordered = useMemo(() => chronologicalGames(games), [games]);
  const total = ordered.length;

  const withGames = useMemo(() => {
    const ids = new Set<string>();
    for (const g of games) {
      for (const id of [...g.sideA, ...g.sideB]) ids.add(id);
    }
    return players
      .filter((p) => ids.has(p.id))
      .sort((a, b) => b.elo - a.elo || a.nickname.localeCompare(b.nickname));
  }, [players, games]);

  const [selected, setSelected] = useState<string[]>([]);
  const [zoom, setZoom] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hover, setHover] = useState<{
    playerId: string;
    i: number;
    x: number;
    y: number;
  } | null>(null);

  const prevFocus = useRef<string | null>(null);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    const focusChanged = focusPlayerId !== prevFocus.current;
    prevFocus.current = focusPlayerId;
    setSelected((cur) => {
      if (
        focusChanged &&
        focusPlayerId &&
        withGames.some((p) => p.id === focusPlayerId)
      ) {
        return [focusPlayerId];
      }
      const keep = cur.filter((id) => withGames.some((p) => p.id === id));
      if (keep.length) return keep;
      return withGames.map((p) => p.id);
    });
  }, [withGames, focusPlayerId]);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const maxWindow = Math.max(MIN_WINDOW, total);
  const windowSize = Math.min(zoom ?? maxWindow, maxWindow);
  const visibleGames = useMemo(
    () => ordered.slice(-windowSize),
    [ordered, windowSize]
  );

  const series = useMemo(
    () => ratingSeriesForPlayers(selected, players, visibleGames),
    [selected, players, visibleGames]
  );

  function toggle(id: string) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
    setHover(null);
  }

  const orderedIds = useMemo(() => withGames.map((p) => p.id), [withGames]);

  const chart = (
    <ChartBody
      series={series}
      players={players}
      orderedIds={orderedIds}
      matchCount={visibleGames.length}
      hover={hover}
      setHover={setHover}
      tall={expanded}
      animate={!reduceMotion}
    />
  );

  const controls = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="w-full sm:max-w-[260px]">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="label !mb-0">Zoom</span>
          <span className="text-xs font-semibold text-[var(--cyan)]">
            {visibleGames.length === total
              ? `All ${total} matches`
              : `Last ${visibleGames.length} of ${total}`}
          </span>
        </div>
        <input
          className="range"
          type="range"
          min={Math.min(MIN_WINDOW, maxWindow)}
          max={maxWindow}
          step={1}
          value={windowSize}
          disabled={total <= MIN_WINDOW}
          onChange={(e) => setZoom(Number(e.target.value))}
          style={{
            ["--range-pct" as string]: `${
              maxWindow === MIN_WINDOW
                ? 100
                : ((windowSize - MIN_WINDOW) / (maxWindow - MIN_WINDOW)) * 100
            }%`,
          }}
          aria-label="Zoom the chart in or out"
        />
        <div className="mt-1 flex justify-between text-[0.7rem] text-[var(--muted)]">
          <span>Zoomed in</span>
          <span>Everything</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="chip"
          onClick={() => setSelected(withGames.map((p) => p.id))}
        >
          Everyone
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => setSelected(withGames.slice(0, 3).map((p) => p.id))}
        >
          Top 3
        </button>
        <button type="button" className="chip" onClick={() => setSelected([])}>
          Clear
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Close" : "Expand"}
        </button>
      </div>
    </div>
  );

  const legend = (
    <div className="flex flex-wrap gap-2">
      {withGames.map((p) => {
        const on = selected.includes(p.id);
        const color = colorFor(p.id, orderedIds);
        return (
          <button
            key={p.id}
            type="button"
            className="chip"
            data-active={on}
            onClick={() => toggle(p.id)}
            style={on ? { borderColor: color, color } : undefined}
          >
            {p.nickname}
          </button>
        );
      })}
      {withGames.length === 0 && (
        <p className="text-sm text-[var(--muted)]">No matches yet.</p>
      )}
    </div>
  );

  return (
    <>
      <div className="space-y-4">
        {controls}
        {legend}
        {chart}
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-[90] flex flex-col bg-[var(--background)]"
          role="dialog"
          aria-modal="true"
          aria-label="Rating over time"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-6">
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              Rating over time
            </h2>
            <button
              type="button"
              className="chip"
              onClick={() => setExpanded(false)}
            >
              Close
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-auto p-4 sm:p-6">
            {controls}
            {legend}
            {chart}
          </div>
        </div>
      )}
    </>
  );
}

interface ChartBodyProps {
  series: ReturnType<typeof ratingSeriesForPlayers>;
  players: Player[];
  orderedIds: string[];
  matchCount: number;
  hover: { playerId: string; i: number; x: number; y: number } | null;
  setHover: (
    h: { playerId: string; i: number; x: number; y: number } | null
  ) => void;
  tall: boolean;
  animate: boolean;
}

function ChartBody({
  series,
  players,
  orderedIds,
  matchCount,
  hover,
  setHover,
  tall,
  animate,
}: ChartBodyProps) {
  if (series.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--border)] bg-[var(--field-bg)] py-12 text-center text-sm text-[var(--muted)]">
        Pick a player to plot their rating.
      </p>
    );
  }

  const allElos = series.flatMap((s) => s.points.map((p) => p.elo));
  const minElo = allElos.length ? Math.min(...allElos) : 1000;
  const maxElo = allElos.length ? Math.max(...allElos) : 1000;
  const pad = Math.max(16, Math.round((maxElo - minElo) * 0.1) || 16);
  const yMin = Math.floor((minElo - pad) / 10) * 10;
  const yMax = Math.ceil((maxElo + pad) / 10) * 10;

  const W = 900;
  const H = tall ? 480 : 360;
  const ml = 46;
  const mr = 128;
  const mt = 14;
  const mb = 32;
  const iw = W - ml - mr;
  const ih = H - mt - mb;

  const span = Math.max(1, matchCount);
  const xAt = (matchIndex: number) =>
    ml + (matchCount <= 1 ? iw / 2 : (matchIndex / span) * iw);
  const yAt = (elo: number) =>
    mt + ((yMax - elo) / Math.max(1, yMax - yMin)) * ih;

  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round(yMin + ((yMax - yMin) * i) / yTicks)
  );

  const ranked = [...series].sort((a, b) => {
    const ae = a.points[a.points.length - 1]?.elo ?? 0;
    const be = b.points[b.points.length - 1]?.elo ?? 0;
    return be - ae;
  });
  const rankOf = new Map(ranked.map((s, i) => [s.playerId, i + 1]));

  const labelMeta = series.map((s) => {
    const last = s.points[s.points.length - 1];
    return {
      playerId: s.playerId,
      nickname: s.nickname,
      elo: last.elo,
      rank: rankOf.get(s.playerId) ?? 0,
      x: xAt(last.matchIndex),
      yNatural: yAt(last.elo),
      color: colorFor(s.playerId, orderedIds),
    };
  });
  const labelYs = dodgeLabelYs(
    labelMeta.map((l) => ({ y: l.yNatural })),
    LABEL_GAP,
    mt + 4,
    H - mb - 4
  );

  return (
    <div
      className="relative overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--field-bg)] px-2 pt-2"
      style={tall ? { minHeight: "60vh" } : undefined}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={`h-auto w-full ${tall ? "min-w-[720px]" : "min-w-[560px]"}`}
        role="img"
        aria-label="Rating over time"
        onMouseLeave={() => setHover(null)}
      >
        {yLabels.map((elo) => {
          const y = yAt(elo);
          return (
            <g key={elo}>
              <line
                x1={ml}
                x2={W - mr}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth="1"
                strokeOpacity={0.55}
              />
              <text
                x={ml - 8}
                y={y + 3.5}
                textAnchor="end"
                fontSize="10.5"
                fontFamily={MONO}
                fill="var(--muted)"
              >
                {elo}
              </text>
            </g>
          );
        })}

        <text
          x={ml}
          y={H - 10}
          fontSize="10.5"
          fontFamily={MONO}
          fill="var(--muted)"
        >
          Older
        </text>
        <text
          x={W - mr}
          y={H - 10}
          textAnchor="end"
          fontSize="10.5"
          fontFamily={MONO}
          fill="var(--muted)"
        >
          Newer
        </text>

        {series.map((s) => {
          const color = colorFor(s.playerId, orderedIds);
          const d = s.points
            .map(
              (p, i) =>
                `${i === 0 ? "M" : "L"} ${xAt(p.matchIndex).toFixed(1)} ${yAt(p.elo).toFixed(1)}`
            )
            .join(" ");
          const last = s.points[s.points.length - 1];
          const interactive = s.points
            .map((p, i) => ({ p, i }))
            .filter(({ p }) => !p.held);

          return (
            <g key={s.playerId}>
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={1.25}
                strokeLinejoin="round"
                strokeLinecap="round"
                pathLength={1}
                style={
                  animate
                    ? {
                        strokeDasharray: 1,
                        strokeDashoffset: 0,
                        animation: "chart-draw-unit 0.85s ease-out",
                      }
                    : undefined
                }
              />
              <circle
                cx={xAt(last.matchIndex)}
                cy={yAt(last.elo)}
                r={2.8}
                fill={color}
                pointerEvents="none"
              />
              {interactive.map(({ p, i }) => {
                const cx = xAt(p.matchIndex);
                const cy = yAt(p.elo);
                const active =
                  hover?.playerId === s.playerId && hover.i === i;
                return (
                  <circle
                    key={`${s.playerId}-${i}`}
                    cx={cx}
                    cy={cy}
                    r={active ? 4.5 : 7}
                    fill={active ? color : "transparent"}
                    style={{ cursor: "crosshair" }}
                    onMouseEnter={() =>
                      setHover({
                        playerId: s.playerId,
                        i,
                        x: cx,
                        y: cy,
                      })
                    }
                  />
                );
              })}
            </g>
          );
        })}

        {labelMeta.map((lab, idx) => {
          const y = labelYs[idx];
          const showGuide = Math.abs(y - lab.yNatural) > 2;
          return (
            <g key={`label-${lab.playerId}`} pointerEvents="none">
              {showGuide && (
                <path
                  d={`M ${lab.x} ${lab.yNatural} L ${lab.x + 10} ${y}`}
                  fill="none"
                  stroke={lab.color}
                  strokeWidth={1}
                  strokeOpacity={0.35}
                />
              )}
              <text
                x={lab.x + 10}
                y={y + 3.5}
                fill={lab.color}
                fontSize={10.5}
                fontFamily={MONO}
              >
                {`#${lab.rank} ${lab.nickname} ${lab.elo}`}
              </text>
            </g>
          );
        })}
      </svg>

      {hover &&
        (() => {
          const s = series.find((x) => x.playerId === hover.playerId);
          const pt = s?.points[hover.i];
          if (!s || !pt || pt.held) return null;
          const player = players.find((p) => p.id === s.playerId);
          const left = hover.x > W * 0.55;
          const rank = rankOf.get(s.playerId);
          return (
            <div
              className="pointer-events-none absolute z-10 max-w-[220px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs shadow-lg"
              style={{
                left: left ? undefined : `${(hover.x / W) * 100}%`,
                right: left ? `${(1 - hover.x / W) * 100}%` : undefined,
                top: `${Math.max(8, (hover.y / H) * 100 - 8)}%`,
                transform: left
                  ? "translate(-8px, -100%)"
                  : "translate(8px, -100%)",
              }}
            >
              <p className="font-medium text-[var(--foreground)]">
                {player ? displayName(player) : s.nickname}
                {rank != null && (
                  <span className="text-[var(--muted)]"> · #{rank}</span>
                )}
              </p>
              <p className="mt-0.5 font-mono text-[var(--cyan)]">
                {pt.elo} ELO
                {pt.delta !== 0 && (
                  <span
                    className={
                      pt.delta > 0
                        ? "text-[var(--lime)]"
                        : "text-[var(--magenta)]"
                    }
                  >
                    {" "}
                    {pt.delta > 0 ? `+${pt.delta}` : pt.delta}
                  </span>
                )}
              </p>
              {pt.opponents && (
                <p className="mt-0.5 text-[var(--muted)]">
                  {pt.scoreline
                    ? `vs ${pt.opponents} · ${pt.scoreline}`
                    : pt.opponents}
                </p>
              )}
            </div>
          );
        })()}
    </div>
  );
}
