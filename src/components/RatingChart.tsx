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
/** Vertical space reserved per end-label (pill height + padding). */
const LABEL_SLOT = 22;
const MONO =
  'ui-monospace, "Cascadia Mono", Consolas, "SF Mono", monospace';

function colorFor(playerId: string, orderedIds: string[]): string {
  const i = orderedIds.indexOf(playerId);
  return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
}

function shortLabelName(nickname: string, max = 14): string {
  const t = nickname.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Always place labels on an evenly spaced right rail (Elo order).
 * Natural Y is only used for leader-line anchors — never for text position —
 * so mid-pack names cannot cover each other.
 */
function placeLabelYs(
  items: { y: number }[],
  slot: number,
  top: number,
  bottom: number
): number[] {
  const n = items.length;
  if (n === 0) return [];

  const order = items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => a.y - b.y || a.index - b.index);

  const avail = Math.max(slot, bottom - top);
  const out = new Array<number>(n);

  if (n === 1) {
    out[order[0].index] = Math.min(bottom, Math.max(top, order[0].y));
    return out;
  }

  // Prefer natural spacing when everyone is already far apart
  const natural = order.map((o) => o.y);
  let canNatural = natural[0] >= top && natural[natural.length - 1] <= bottom;
  for (let i = 1; canNatural && i < natural.length; i++) {
    if (natural[i] - natural[i - 1] < slot) canNatural = false;
  }
  if (canNatural) {
    order.forEach((o, i) => {
      out[o.index] = natural[i];
    });
    return out;
  }

  // Dense pack: equal gaps so nothing overlaps (compress only if chart is short)
  const gap = Math.max(14, Math.min(slot, avail / (n - 1)));
  const used = gap * (n - 1);
  const shift = used < avail ? (avail - used) / 2 : 0;
  order.forEach((o, i) => {
    out[o.index] = top + shift + gap * i;
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
  const pad = Math.max(20, Math.round((maxElo - minElo) * 0.1) || 20);
  const yMin = Math.floor((minElo - pad) / 10) * 10;
  const yMax = Math.ceil((maxElo + pad) / 10) * 10;

  // Taller plot + wide fixed right rail so end-labels never cover each other
  const W = 1000;
  const H = tall ? 580 : 460;
  const ml = 52;
  const mr = 210;
  const mt = 20;
  const mb = 38;
  const iw = W - ml - mr;
  const ih = H - mt - mb;
  const labelRailX = W - mr + 10;

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
  const labelYs = placeLabelYs(
    labelMeta.map((l) => ({ y: l.yNatural })),
    LABEL_SLOT,
    mt + 10,
    H - mb - 10
  );

  // Paint top→bottom so lower labels aren't covered by earlier DOM siblings
  const labelDrawOrder = labelMeta
    .map((lab, idx) => ({ lab, idx, y: labelYs[idx] }))
    .sort((a, b) => a.y - b.y);

  const strokeW = series.length <= 3 ? 2.85 : 2.45;

  return (
    <div
      className="relative overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--field-bg)] px-2 pt-2"
      style={tall ? { minHeight: "65vh" } : undefined}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={`h-auto w-full ${tall ? "min-w-[860px]" : "min-w-[760px]"}`}
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
                x={ml - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="12"
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
          y={H - 12}
          fontSize="12"
          fontFamily={MONO}
          fill="var(--muted)"
        >
          Older
        </text>
        <text
          x={W - mr}
          y={H - 12}
          textAnchor="end"
          fontSize="12"
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
                strokeWidth={strokeW}
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
                r={4.2}
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
                    r={active ? 5.5 : 8}
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

        {labelDrawOrder.map(({ lab, y }) => {
          const text = `#${lab.rank} ${shortLabelName(lab.nickname)} ${lab.elo}`;
          const tw = Math.min(mr - 16, Math.max(88, text.length * 7.6));
          const pillH = 20;
          const rx = labelRailX;
          const ry = y - pillH / 2;
          const elbowX = lab.x + Math.max(8, (labelRailX - lab.x) * 0.35);
          return (
            <g key={`label-${lab.playerId}`} pointerEvents="none">
              <path
                d={`M ${lab.x} ${lab.yNatural} L ${elbowX.toFixed(1)} ${y} L ${rx - 2} ${y}`}
                fill="none"
                stroke={lab.color}
                strokeWidth={1.35}
                strokeOpacity={0.5}
              />
              <rect
                x={rx - 5}
                y={ry}
                width={tw}
                height={pillH}
                rx={5}
                fill="rgba(11, 21, 36, 0.94)"
                stroke={lab.color}
                strokeOpacity={0.55}
                strokeWidth={1.1}
              />
              <text
                x={rx}
                y={y + 4.5}
                fill={lab.color}
                fontSize={13}
                fontFamily={MONO}
                fontWeight={600}
              >
                {text}
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
