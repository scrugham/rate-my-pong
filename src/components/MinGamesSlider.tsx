"use client";

interface MinGamesSliderProps {
  value: number;
  onChange: (value: number) => void;
  max: number;
  min?: number;
  id: string;
}

export function MinGamesSlider({
  value,
  onChange,
  max,
  min = 0,
  id,
}: MinGamesSliderProps) {
  const top = Math.max(min, max);
  const disabled = top <= min;
  const span = Math.max(1, top - min);
  const pct = ((Math.min(value, top) - min) / span) * 100;

  return (
    <div className="min-games">
      <div className="min-games-head">
        <label className="label !mb-0" htmlFor={id}>
          Min games
        </label>
        <span className="min-games-value">
          {value <= min && min === 0 ? "Any" : `${value}+`}
        </span>
      </div>
      <input
        id={id}
        className="range"
        type="range"
        min={min}
        max={top}
        step={1}
        value={Math.min(value, top)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--range-pct" as string]: `${pct}%` }}
        aria-valuetext={value <= min && min === 0 ? "Any" : `${value} or more games`}
      />
      <div className="min-games-scale">
        <span>{min === 0 ? "Any" : `${min}+`}</span>
        <span>{top}+</span>
      </div>
    </div>
  );
}
