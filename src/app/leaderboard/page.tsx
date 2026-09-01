import { LeaderboardView } from "@/components/LeaderboardView";
import { RatingTrends } from "@/components/RatingTrends";

export default function LeaderboardPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
          Leaderboard
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Main ranks by Elo. Singles and Doubles rank by win % in that format.
        </p>
      </div>

      <div className="panel p-4 sm:p-5">
        <LeaderboardView />
      </div>

      <div className="panel mt-5 p-4 sm:p-5">
        <RatingTrends />
      </div>
    </section>
  );
}
