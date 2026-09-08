"use client";

import { useEffect, useState } from "react";
import { DataLoading } from "@/components/DataLoading";
import { RatingChart } from "@/components/RatingChart";
import type { Game, Player } from "@/lib/types";

export function RatingTrends() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/players"), fetch("/api/games")])
      .then(async ([pr, gr]) => {
        const pd = await pr.json();
        const gd = await gr.json();
        setPlayers(pd.players ?? []);
        setGames(gd.games ?? []);
      })
      .catch(() => setError("Could not load trends."))
      .finally(() => setReady(true));
  }, []);

  if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;
  if (!ready) return <DataLoading />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Rating over time
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Match by match, oldest on the left. Idle stretches hold last Elo.
          Tap a name to hide them, zoom for a shorter run, expand for a bigger
          view. Rankings under the chart show current Elo in the window.
        </p>
      </div>
      <RatingChart players={players} games={games} />
    </div>
  );
}
