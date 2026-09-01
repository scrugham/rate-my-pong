"use client";

import { useMemo, useState } from "react";
import { STARTING_ELO, expectedScore } from "@/lib/elo";

export function ChanceCurve() {
  const w = 560;
  const h = 180;
  const pad = 18;
  const points = Array.from({ length: 41 }, (_, i) => {
    const gap = -400 + i * 20;
    const p = expectedScore(1000 + gap, 1000);
    const x = pad + ((gap + 400) / 800) * (w - pad * 2);
    const y = h - pad - p * (h - pad * 2);
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-auto w-full"
      role="img"
      aria-label="Win chance versus rating gap"
    >
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={pad}
          x2={w - pad}
          y1={h - pad - t * (h - pad * 2)}
          y2={h - pad - t * (h - pad * 2)}
          stroke="currentColor"
          strokeOpacity="0.12"
        />
      ))}
      <line
        x1={w / 2}
        x2={w / 2}
        y1={pad}
        y2={h - pad}
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeDasharray="3 4"
      />
      <path
        d={points}
        fill="none"
        stroke="var(--cyan)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <text x={pad} y={h - 2} fontSize="10" fill="currentColor" opacity="0.5">
        −400
      </text>
      <text
        x={w / 2}
        y={h - 2}
        textAnchor="middle"
        fontSize="10"
        fill="currentColor"
        opacity="0.5"
      >
        even
      </text>
      <text
        x={w - pad}
        y={h - 2}
        textAnchor="end"
        fontSize="10"
        fill="currentColor"
        opacity="0.5"
      >
        +400
      </text>
    </svg>
  );
}

export function LiveOdds() {
  const [you, setYou] = useState(STARTING_ELO);
  const [them, setThem] = useState(STARTING_ELO);
  const chance = useMemo(() => expectedScore(you, them), [you, them]);
  const pct = Math.round(chance * 100);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Your rating
          </span>
          <input
            className="field text-2xl font-semibold tabular-nums"
            inputMode="numeric"
            value={you}
            onChange={(e) =>
              setYou(Number(e.target.value.replace(/[^\d]/g, "")) || 0)
            }
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Opponent
          </span>
          <input
            className="field text-2xl font-semibold tabular-nums"
            inputMode="numeric"
            value={them}
            onChange={(e) =>
              setThem(Number(e.target.value.replace(/[^\d]/g, "")) || 0)
            }
          />
        </label>
      </div>
      <div>
        <p className="text-5xl font-semibold tracking-tight tabular-nums text-[var(--cyan)]">
          {pct}%
        </p>
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
          Your chance to win
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {you === them
            ? "Even ratings. Coin flip."
            : you > them
              ? `Favorite by ${you - them} ELO. Opponent is at ${100 - pct}%.`
              : `Underdog by ${them - you} ELO. Opponent is at ${100 - pct}%.`}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--track)]">
        <div
          className="h-full rounded-full bg-[var(--cyan)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
