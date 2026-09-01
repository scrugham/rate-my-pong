import { ChanceCurve, LiveOdds } from "@/components/AboutOdds";
import { GAPS, K_TIERS, MARGINS, STEPS, TEAM_EXAMPLES } from "@/lib/about";

export const metadata = { title: "About · Rate My Pong" };

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--cyan)]">
            About the rating
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            The math behind the board.
          </h1>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-[var(--muted)]">
          One ELO per player. Singles and doubles both count. The number on
          the board is a running total — each new match applies the math
          below.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="panel p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Live odds
          </p>
          <div className="mt-6">
            <LiveOdds />
          </div>
        </div>
        <div className="panel p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            The curve
          </p>
          <div className="mt-8 text-[var(--foreground)]">
            <ChanceCurve />
          </div>
          <p className="mt-4 font-mono text-[13px] text-[var(--cyan)]">
            1 / (1 + 10^((opp − you) / 400))
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
            Divide the gap by 400 first. Then raise 10 to that power. This is
            expected win chance only — not the points that move.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {STEPS.map((s) => (
          <article key={s.n} className="panel p-5">
            <p className="text-xs font-semibold tabular-nums text-[var(--cyan)]">
              {s.n}
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{s.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-sm font-semibold">K factor</h2>
          </div>
          <ul>
            {K_TIERS.map((t) => (
              <li
                key={t.label}
                className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] px-5 py-4 last:border-0"
              >
                <span>
                  <span className="block text-sm font-medium">{t.label}</span>
                  <span className="text-xs text-[var(--muted)]">{t.hint}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-[var(--lime)]">
                  K = {t.k}
                </span>
              </li>
            ))}
          </ul>
          <p className="px-5 py-4 text-xs leading-relaxed text-[var(--muted)]">
            Each player uses their own K. A provisional player can gain or
            lose more than the veteran across the net. The match is not
            zero-sum on purpose, so a new 1000 does not have to drain the
            office pool to climb.
          </p>
        </div>
        <div className="panel overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-sm font-semibold">Doubles team Elo (scouting)</h2>
          </div>
          <ul>
            {TEAM_EXAMPLES.map((t) => (
              <li
                key={t.pair}
                className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] px-5 py-4 last:border-0"
              >
                <span>
                  <span className="block text-sm font-medium">{t.pair}</span>
                  <span className="text-xs text-[var(--muted)]">{t.hint}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-[var(--lime)]">
                  {t.elo}
                </span>
              </li>
            ))}
          </ul>
          <p className="px-5 py-4 text-xs leading-relaxed text-[var(--muted)]">
            65/35 is only how the system sizes the favorite before the
            match. Both partners then get the same Δ. It is not a 65/35
            split of the points.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-sm font-semibold">If they are this much higher</h2>
          </div>
          <ul>
            {GAPS.map((g) => (
              <li
                key={g.gap}
                className="flex items-center gap-4 border-b border-[var(--border)] px-5 py-3.5 last:border-0"
              >
                <span className="w-16 text-sm text-[var(--muted)]">
                  {g.gap === 0 ? "Even" : `+${g.gap}`}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--track)]">
                  <span
                    className="block h-full rounded-full bg-[var(--cyan)]"
                    style={{ width: `${g.pct}%` }}
                  />
                </span>
                <span className="w-12 text-right text-sm font-semibold tabular-nums">
                  {g.pct}%
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-sm font-semibold">Score margin (before autocorrelation)</h2>
          </div>
          <ul>
            {MARGINS.map((m) => (
              <li
                key={m.label}
                className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] px-5 py-4 last:border-0"
              >
                <span>
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="text-xs text-[var(--muted)]">{m.hint}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-[var(--lime)]">
                  × {m.mult}
                </span>
              </li>
            ))}
          </ul>
          <p className="px-5 py-4 text-xs leading-relaxed text-[var(--muted)]">
            Base MoV is 0.70 + 0.06 × (point gap), clipped to 0.82–1.18 so
            11–6 is ×1.00. That product is then multiplied by
            2.5 / ((winner − loser) / 400 + 2.5). Expected blowouts shrink;
            upsets grow. That second factor is not clipped.
          </p>
        </div>
      </div>

      <article className="panel mt-5 space-y-4 p-6 text-sm leading-relaxed text-[var(--muted)] sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
          How the rating is built
        </h2>
        <p>
          Everyone starts at 1000. There is one rating per person. Singles
          and doubles both write to it. The board is a running total: past
          results stay as logged, and every new match applies this formula.
          Your first 10 games (wins + losses, either format) use K = 64 so
          a new player races toward their real level. After that, K = 32.
          Each player uses their own K, so a provisional player can gain or
          lose more than the veteran on the other side of the net. That is
          intentional: it mints (or removes) points instead of draining the
          established pool while someone climbs from a 1000 that is not
          their true skill.
        </p>
        <p>
          Singles compares the two ratings directly. Doubles does not take a
          plain average. The weaker partner is weighted 65% and the stronger
          35%, because in alternate-hit ping-pong the weaker player sets more
          of the team’s floor. Two 1100s are still 1100. A 1400 with an 800
          is 1010, so two 1100s are correctly treated as favorites. Once the
          team ratings exist, both partners on a side get the same match
          outcome — the 65/35 split is only for scouting, not for splitting
          the points 65/35. Each partner still applies their own K to that
          outcome.
        </p>
        <p>
          Expected win chance is classic Elo: 1 / (1 + 10^((opponent − you)
          / 400)). The gap is divided by 400 inside the exponent. A
          100-point favorite is about 64%. Then the points that actually
          move are:
        </p>
        <p className="font-mono text-[13px] text-[var(--cyan)]">
          Δ = K × MoV × autocorrelation × (1 − expected)
        </p>
        <p>
          MoV is 0.70 + 0.06 × (winner score − loser score), clipped to
          0.82–1.18. That band is symmetric around 11–6, the median margin
          in this office’s logged exact scores. Deuce with no tally is a
          2-point win. Autocorrelation is the FiveThirtyEight-style term
          2.5 / ((winner Elo − loser Elo) / 400 + 2.5), using those team
          ratings in doubles. If a big favorite wins big, the extra margin
          is discounted — the system already expected a beating. If an
          underdog wins, the same term is greater than 1, so the upset is
          worth more. That term is not clipped again, so it can stretch the
          multiplier outside 0.82–1.18.
        </p>
        <p>
          That is why two wins can print +18 and +24. One was closer, more
          expected, or against a smaller gap; the other was not. Dates are
          never shown.
        </p>
      </article>
    </section>
  );
}
