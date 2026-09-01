"use client";

import { useEffect, useState } from "react";
import { RatingChart } from "@/components/RatingChart";
import type { Game, Player } from "@/lib/types";

export function RatingTrends() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/players"), fetch("/api/games")])
      .then(async ([pr, gr]) => {
        const pd = await pr.json();
        const gd = await gr.json();
        setPlayers(pd.players ?? []);
        setGames(gd.games ?? []);
      })
      .catch(() => setError("Could not load trends."));
  }, []);

  if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Rating over time
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Match by match, oldest on the left. Everyone starts plotted; tap a
          name to hide them. Drag the zoom to focus on a shorter run, and
          expand for a bigger view.
        </p>
      </div>
      <RatingChart players={players} games={games} />
    </div>
  );
}
