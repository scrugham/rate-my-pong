"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlayerPicker } from "@/components/PlayerPicker";
import { SeriesGameRowEditor } from "@/components/SeriesGameRowEditor";
import { saveLastResult } from "@/lib/last-result";
import {
  mergeEloChanges,
  newGameDraft,
  seriesTally,
  validateGame,
  type SeriesGameDraft,
} from "@/lib/series";
import type { EloSnapshot, Game, MatchFormat, Player } from "@/lib/types";

export function LogMatchForm() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [format, setFormat] = useState<MatchFormat>("singles");
  const [a1, setA1] = useState<string | null>(null);
  const [a2, setA2] = useState<string | null>(null);
  const [b1, setB1] = useState<string | null>(null);
  const [b2, setB2] = useState<string | null>(null);
  const [games, setGames] = useState<SeriesGameDraft[]>([newGameDraft()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [writeAllowed, setWriteAllowed] = useState<boolean | null>(null);
  const router = useRouter();

  async function loadPlayers() {
    const res = await fetch("/api/players");
    const data = await res.json();
    setPlayers(data.players ?? []);
  }

  useEffect(() => {
    loadPlayers().catch(() => setError("Could not load roster."));
  }, []);

  useEffect(() => {
    fetch("/api/write-access")
      .then((r) => r.json())
      .then((d) => setWriteAllowed(Boolean(d.allowed)))
      .catch(() => setWriteAllowed(false));
  }, []);

  useEffect(() => {
    if (format === "singles") {
      setA2(null);
      setB2(null);
    }
  }, [format]);

  const excludeFor = useMemo(() => {
    return [a1, a2, b1, b2].filter(Boolean) as string[];
  }, [a1, a2, b1, b2]);

  const nick = (id: string | null) =>
    id ? players.find((p) => p.id === id)?.nickname ?? null : null;

  const sideALabel = useMemo(() => {
    const names = [nick(a1), format === "doubles" ? nick(a2) : null].filter(
      Boolean
    ) as string[];
    return names.length ? names.join(" & ") : "Side A";
  }, [a1, a2, format, players]);

  const sideBLabel = useMemo(() => {
    const names = [nick(b1), format === "doubles" ? nick(b2) : null].filter(
      Boolean
    ) as string[];
    return names.length ? names.join(" & ") : "Side B";
  }, [b1, b2, format, players]);

  const rosterReady =
    format === "singles"
      ? Boolean(a1 && b1)
      : Boolean(a1 && a2 && b1 && b2);

  const tally = useMemo(() => seriesTally(games), [games]);

  function updateGame(id: string, next: SeriesGameDraft) {
    setGames((cur) => cur.map((g) => (g.id === id ? next : g)));
  }

  function addGameRow() {
    setGames((cur) => [...cur, newGameDraft()]);
  }

  function removeGameRow(id: string) {
    setGames((cur) => (cur.length <= 1 ? cur : cur.filter((g) => g.id !== id)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (writeAllowed === false) {
      setError(
        "Looks like you’re outside the allowed network. Switch to office Wi‑Fi (or open this at the office) to log a match."
      );
      return;
    }

    setLoading(true);

    const sideA = format === "singles" ? [a1] : [a1, a2];
    const sideB = format === "singles" ? [b1] : [b1, b2];

    if (sideA.some((x) => !x) || sideB.some((x) => !x)) {
      setError("Pick every player before logging.");
      setLoading(false);
      return;
    }

    for (let i = 0; i < games.length; i++) {
      const err = validateGame(games[i]);
      if (err) {
        setError(`Game ${i + 1}: ${err}`);
        setLoading(false);
        return;
      }
    }

    try {
      let mergedChanges: Record<string, EloSnapshot> = {};

      for (const game of games) {
        const res = await fetch("/api/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format,
            sideA,
            sideB,
            scoreMode: game.scoreMode,
            ...(game.scoreMode === "exact"
              ? {
                  scoreA: Number(game.scoreA),
                  scoreB: Number(game.scoreB),
                }
              : { winner: game.deuceWinner }),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to log match.");

        const logged = data.game as Game;
        mergedChanges = mergeEloChanges(mergedChanges, logged.eloChanges);
      }

      saveLastResult(mergedChanges);
      router.push("/leaderboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log match.");
      setLoading(false);
    }
  }

  const submitLabel =
    games.length === 1
      ? loading
        ? "Logging..."
        : "Log match"
      : loading
        ? "Logging series..."
        : `Log series (${games.length} games)`;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(["singles", "doubles"] as MatchFormat[]).map((f) => (
          <button
            key={f}
            type="button"
            className="chip"
            data-active={format === f}
            onClick={() => setFormat(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="form-section space-y-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {sideALabel}
          </p>
          <PlayerPicker
            label="Player 1"
            players={players}
            value={a1}
            onChange={setA1}
            excludeIds={excludeFor.filter((id) => id !== a1)}
          />
          {format === "doubles" && (
            <PlayerPicker
              label="Player 2"
              players={players}
              value={a2}
              onChange={setA2}
              excludeIds={excludeFor.filter((id) => id !== a2)}
            />
          )}
        </div>

        <div className="form-section space-y-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {sideBLabel}
          </p>
          <PlayerPicker
            label="Player 1"
            players={players}
            value={b1}
            onChange={setB1}
            excludeIds={excludeFor.filter((id) => id !== b1)}
          />
          {format === "doubles" && (
            <PlayerPicker
              label="Player 2"
              players={players}
              value={b2}
              onChange={setB2}
              excludeIds={excludeFor.filter((id) => id !== b2)}
            />
          )}
        </div>
      </div>

      {rosterReady && (
        <>
          {games.length > 1 && (
            <div className="rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-sm text-[var(--muted)]">
              Series so far:{" "}
              <span className="font-semibold text-[var(--foreground)]">
                {tally.a}-{tally.b}
              </span>
              {tally.a !== tally.b && (
                <>
                  {" "}
                  ({tally.a > tally.b ? sideALabel : sideBLabel} leads)
                </>
              )}
            </div>
          )}

          <div className="space-y-4">
            {games.map((g, i) => (
              <div
                key={g.id}
                className="form-section space-y-4 border border-[var(--border)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="form-section-title !mb-0">
                    {games.length === 1 ? "Result" : `Game ${i + 1}`}
                  </p>
                  {games.length > 1 && (
                    <button
                      type="button"
                      className="chip !px-2 !py-1 text-xs"
                      onClick={() => removeGameRow(g.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <SeriesGameRowEditor
                  game={g}
                  labelA={sideALabel}
                  labelB={sideBLabel}
                  onChange={(next) => updateGame(g.id, next)}
                />
                {i === 0 && games.length === 1 && (
                  <p className="form-hint">
                    {g.scoreMode === "exact"
                      ? "Closer scores move ELO less. Expected blowouts are discounted."
                      : "Forgot the tally? Pick the winner. Treated as a close game for ELO."}
                  </p>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            className="chip w-full sm:w-auto"
            onClick={addGameRow}
          >
            + Add another game
          </button>
        </>
      )}

      {players.length === 0 && (
        <p className="form-hint">
          No players yet.{" "}
          <Link href="/join" className="text-[var(--cyan)] underline">
            Add a player
          </Link>
          .
        </p>
      )}

      {writeAllowed === false && (
        <p
          className="rounded-lg border border-[rgba(242,169,0,0.35)] bg-[rgba(242,169,0,0.08)] px-3 py-2 text-sm text-[var(--foreground)]"
          role="status"
          aria-live="polite"
        >
          Looks like you’re outside the allowed network. Switch to office
          Wi‑Fi (or open this at the office) to log a match.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-[rgba(177,35,115,0.35)] bg-[rgba(177,35,115,0.08)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <div className="pt-1">
        <button
          type="submit"
          className="btn-primary w-full sm:w-auto"
          disabled={loading || !rosterReady || writeAllowed === false}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
