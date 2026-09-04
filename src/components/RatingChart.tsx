"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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
const MONO =
  'ui-monospace, "Cascadia Mono", Consolas, "SF Mono", monospace';

function colorFor(playerId: string, orderedIds: string[]): string {
  const i = orderedIds.indexOf(playerId);
  return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
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

  const zoomLabel =
    visibleGames.length === total
      ? `All ${total} matches`
      : `Last ${visibleGames.length} of ${total}`;

  const zoomControl = (
    <div className="min-w-[140px] flex-1 sm:max-w-[280px]">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="label !mb-0">Zoom</span>
        <span className="text-xs font-semibold text-[var(--cyan)]">
          {zoomLabel}
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
    </div>
  );

  const presetBtns = (
    <>
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
    </>
  );

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
      onTogglePlayer={toggle}
      selected={selected}
      fillIdPrefix={expanded ? "x" : "i"}
    />
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
      {!expanded && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            {zoomControl}
            <div className="flex flex-wrap gap-2">
              {presetBtns}
              <button
                type="button"
                className="chip"
                onClick={() => setExpanded(true)}
              >
                Expand
              </button>
            </div>
          </div>
          {legend}
          {chart}
        </div>
      )}

      {expanded && (
        <div
          className="fixed inset-0 z-[90] flex flex-col bg-[var(--background)]"
          role="dialog"
          aria-modal="true"
          aria-label="Rating over time"
        >
          <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border)] px-4 py-2.5 sm:gap-4 sm:px-6">
            <h2 className="shrink-0 text-base font-semibold text-[var(--foreground)]">
              Rating over time
            </h2>
            <div className="order-3 flex w-full flex-wrap items-end gap-3 sm:order-none sm:w-auto sm:flex-1 sm:gap-4">
              {zoomControl}
              <div className="flex flex-wrap gap-2">{presetBtns}</div>
            </div>
            <button
              type="button"
              className="chip ml-auto"
              onClick={() => setExpanded(false)}
            >
              Close
            </button>
          </header>
          <div className="shrink-0 border-b border-[var(--border)] px-4 py-2.5 sm:px-6">
            {legend}
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
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
  selected: string[];
  onTogglePlayer: (id: string) => void;
  /** Avoid duplicate SVG gradient ids if both modes ever mount. */
  fillIdPrefix?: string;
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
  selected,
  onTogglePlayer,
  fillIdPrefix = "c",
}: ChartBodyProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const drewOnce = useRef(false);
  const [doDraw, setDoDraw] = useState(false);
  const [plotSize, setPlotSize] = useState({ w: 720, h: 380 });

  useEffect(() => {
    if (!animate || drewOnce.current) return;
    drewOnce.current = true;
    setDoDraw(true);
  }, [animate]);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr || cr.width < 40 || cr.height < 40) return;
      setPlotSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [tall]);

  if (series.length === 0) {
    return (
      <p
        className={`rounded-lg border border-[var(--border)] bg-[var(--field-bg)] py-12 text-center text-sm text-[var(--muted)] ${
          tall ? "flex h-full items-center justify-center" : ""
        }`}
      >
        Pick a player to plot their rating.
      </p>
    );
  }

  const allElos = series.flatMap((s) => s.points.map((p) => p.elo));
  const minElo = allElos.length ? Math.min(...allElos) : 1000;
  const maxElo = allElos.length ? Math.max(...allElos) : 1000;
  const pad = Math.max(24, Math.round((maxElo - minElo) * 0.1) || 24);
  const yMin = Math.floor((minElo - pad) / 10) * 10;
  const yMax = Math.ceil((maxElo + pad) / 10) * 10;

  const W = tall ? Math.max(480, Math.round(plotSize.w)) : 720;
  const H = tall ? Math.max(280, Math.round(plotSize.h)) : 380;
  const ml = 48;
  const mr = 20;
  const mt = 18;
  const mb = 30;
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

  const strokeW = series.length <= 3 ? 2.8 : 2.35;

  function svgPoint(evt: MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
  }

  function eloAtMatch(
    points: { matchIndex: number; elo: number }[],
    matchF: number
  ): number | null {
    if (!points.length) return null;
    if (matchF <= points[0].matchIndex) return points[0].elo;
    const last = points[points.length - 1];
    if (matchF >= last.matchIndex) return last.elo;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (matchF <= b.matchIndex) {
        const t =
          (matchF - a.matchIndex) / Math.max(1e-6, b.matchIndex - a.matchIndex);
        return a.elo + (b.elo - a.elo) * t;
      }
    }
    return last.elo;
  }

  function nearestHit(svgX: number, svgY: number) {
    if (svgX < ml - 6 || svgX > W - mr + 6) return null;

    const matchF =
      matchCount <= 1
        ? 1
        : ((svgX - ml) / Math.max(1, iw)) * span;

    // Pick the series whose line is closest in Y at this X (not nearest game-dot)
    type Cand = { playerId: string; yDist: number; lineY: number };
    const cands: Cand[] = [];
    for (const s of series) {
      const elo = eloAtMatch(s.points, matchF);
      if (elo == null) continue;
      const lineY = yAt(elo);
      cands.push({
        playerId: s.playerId,
        yDist: Math.abs(lineY - svgY),
        lineY,
      });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => a.yDist - b.yDist);
    const closest = cands[0];
    if (closest.yDist > 36) return null;

    // If two lines are nearly tied, stick with the current hover so it doesn't flicker
    const sticky = hover?.playerId;
    let pick = closest;
    if (sticky) {
      const cur = cands.find((c) => c.playerId === sticky);
      if (cur && cur.yDist <= closest.yDist + 10 && cur.yDist <= 40) {
        pick = cur;
      }
    }

    const s = series.find((x) => x.playerId === pick.playerId);
    if (!s) return null;

    // Tip: nearest sample; prefer a nearby real game over a flat-hold sample
    let bestI = 0;
    let bestScore = Infinity;
    for (let i = 0; i < s.points.length; i++) {
      const p = s.points[i];
      const d = Math.abs(p.matchIndex - matchF);
      const score = d + (p.held ? 2.5 : 0);
      if (score < bestScore) {
        bestScore = score;
        bestI = i;
      }
    }

    return {
      playerId: s.playerId,
      i: bestI,
      x: svgX,
      y: pick.lineY,
    };
  }

  const hoverSeries = hover
    ? series.find((s) => s.playerId === hover.playerId)
    : null;
  const hoverPt = hoverSeries?.points[hover!.i];
  const tipBelow = hover ? hover.y < H * 0.28 : false;

  return (
    <div
      className={`rounded-lg border border-[var(--border)] bg-[var(--field-bg)] ${
        tall ? "flex h-full min-h-0 flex-col" : ""
      }`}
    >
      <div
        ref={plotRef}
        className={`relative min-w-0 p-2 sm:p-3 ${
          tall ? "min-h-0 flex-1" : ""
        }`}
      >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className={tall ? "h-full w-full" : "h-auto w-full"}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Rating over time"
            style={{ cursor: "crosshair" }}
            onMouseLeave={() => setHover(null)}
            onMouseMove={(evt) => {
              const pt = svgPoint(evt);
              if (!pt) return;
              const hit = nearestHit(pt.x, pt.y);
              if (!hit) {
                if (hover) setHover(null);
                return;
              }
              if (
                !hover ||
                hover.playerId !== hit.playerId ||
                hover.i !== hit.i ||
                Math.abs(hover.x - hit.x) > 0.5 ||
                Math.abs(hover.y - hit.y) > 0.5
              ) {
                setHover({
                  playerId: hit.playerId,
                  i: hit.i,
                  x: hit.x,
                  y: hit.y,
                });
              }
            }}
          >
            <defs>
              {series.map((s) => {
                const color = colorFor(s.playerId, orderedIds);
                return (
                  <linearGradient
                    key={`fill-${s.playerId}`}
                    id={`${fillIdPrefix}-rating-fill-${s.playerId}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={color} stopOpacity="0.32" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                  </linearGradient>
                );
              })}
            </defs>

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
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
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
              y={H - 8}
              fontSize="11"
              fontFamily={MONO}
              fill="var(--muted)"
            >
              Older
            </text>
            <text
              x={W - mr}
              y={H - 8}
              textAnchor="end"
              fontSize="11"
              fontFamily={MONO}
              fill="var(--muted)"
            >
              Newer
            </text>

            {series.map((s) => {
              const color = colorFor(s.playerId, orderedIds);
              const active = hover?.playerId === s.playerId;
              const dim = hover != null && !active;
              const d = s.points
                .map(
                  (p, i) =>
                    `${i === 0 ? "M" : "L"} ${xAt(p.matchIndex).toFixed(1)} ${yAt(p.elo).toFixed(1)}`
                )
                .join(" ");
              const last = s.points[s.points.length - 1];
              const first = s.points[0];
              const areaD =
                s.points.length >= 2
                  ? `${d} L ${xAt(last.matchIndex).toFixed(1)} ${H - mb} L ${xAt(first.matchIndex).toFixed(1)} ${H - mb} Z`
                  : "";
              return (
                <g
                  key={s.playerId}
                  opacity={dim ? 0.28 : 1}
                  style={{ transition: "opacity 0.12s ease" }}
                >
                  {active && areaD && (
                    <path
                      d={areaD}
                      fill={`url(#${fillIdPrefix}-rating-fill-${s.playerId})`}
                      pointerEvents="none"
                    />
                  )}
                  <path
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth={active ? strokeW + 0.7 : strokeW}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    pathLength={1}
                    style={
                      doDraw
                        ? {
                            strokeDasharray: 1,
                            strokeDashoffset: 0,
                            animation: "chart-draw-unit 0.75s ease-out",
                          }
                        : undefined
                    }
                  />
                  <circle
                    cx={xAt(last.matchIndex)}
                    cy={yAt(last.elo)}
                    r={active ? 4.5 : 3.4}
                    fill={color}
                  />
                </g>
              );
            })}

            {hover && (
              <circle
                cx={hover.x}
                cy={hover.y}
                r={5.5}
                fill={colorFor(hover.playerId, orderedIds)}
                stroke="var(--background)"
                strokeWidth={2}
              />
            )}
          </svg>

          {hover && hoverSeries && hoverPt && (
            <div
              className="pointer-events-none absolute z-20 max-w-[240px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm shadow-xl"
              style={{
                left: `${Math.min(72, Math.max(4, (hover.x / W) * 100))}%`,
                top: tipBelow
                  ? `${Math.min(88, (hover.y / H) * 100 + 3)}%`
                  : `${Math.max(4, (hover.y / H) * 100)}%`,
                transform: tipBelow
                  ? "translate(-50%, 0)"
                  : "translate(-50%, calc(-100% - 10px))",
              }}
            >
              <p className="font-semibold text-[var(--foreground)]">
                {(() => {
                  const player = players.find((p) => p.id === hoverSeries.playerId);
                  return player ? displayName(player) : hoverSeries.nickname;
                })()}
                <span className="font-normal text-[var(--muted)]">
                  {" "}
                  · #{rankOf.get(hoverSeries.playerId)}
                </span>
              </p>
              <p className="mt-0.5 font-mono text-[var(--cyan)]">
                {hoverPt.elo} ELO
                {hoverPt.held ? (
                  <span className="font-sans text-[var(--muted)]"> · holding</span>
                ) : hoverPt.delta !== 0 ? (
                  <span
                    className={
                      hoverPt.delta > 0
                        ? "text-[var(--lime)]"
                        : "text-[var(--magenta)]"
                    }
                  >
                    {" "}
                    {hoverPt.delta > 0 ? `+${hoverPt.delta}` : hoverPt.delta}
                  </span>
                ) : null}
              </p>
              {hoverPt.held ? (
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  No game this match · last Elo held
                </p>
              ) : hoverPt.opponents ? (
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {hoverPt.scoreline
                    ? `vs ${hoverPt.opponents} · ${hoverPt.scoreline}`
                    : hoverPt.opponents}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <aside className="shrink-0 border-t border-[var(--border)]">
          <div className="px-3 py-2 sm:px-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Now
            </p>
            <ul className="mt-1.5 grid grid-cols-1 gap-0.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {ranked.map((s) => {
                const color = colorFor(s.playerId, orderedIds);
                const last = s.points[s.points.length - 1];
                const rank = rankOf.get(s.playerId) ?? 0;
                const on = selected.includes(s.playerId);
                const lit = hover?.playerId === s.playerId;
                return (
                  <li key={s.playerId}>
                    <button
                      type="button"
                      onClick={() => onTogglePlayer(s.playerId)}
                      onMouseEnter={() => {
                        const gameIdx = [...s.points]
                          .map((p, i) => ({ p, i }))
                          .reverse()
                          .find((x) => !x.p.held)?.i;
                        const i =
                          gameIdx ?? Math.max(0, s.points.length - 1);
                        const pt = s.points[i];
                        setHover({
                          playerId: s.playerId,
                          i,
                          x: xAt(pt.matchIndex),
                          y: yAt(pt.elo),
                        });
                      }}
                      onMouseLeave={() => setHover(null)}
                      className="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--field-bg)]"
                      style={{
                        background: lit ? `${color}18` : undefined,
                        opacity: on ? 1 : 0.45,
                      }}
                      title="Click to show/hide on chart"
                    >
                      <span
                        className="w-6 shrink-0 font-mono text-xs tabular-nums"
                        style={{ color }}
                      >
                        #{rank}
                      </span>
                      <span
                        className="min-w-0 flex-1 truncate text-sm font-semibold"
                        style={{ color }}
                      >
                        {s.nickname}
                      </span>
                      <span
                        className="shrink-0 font-mono text-sm tabular-nums"
                        style={{ color }}
                      >
                        {last.elo}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
    </div>
  );
}
