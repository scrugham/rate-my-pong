"use client";

import { useCallback, useEffect, useState } from "react";
import type { UndoSessionPreview } from "@/lib/undo-session";

function formatRemaining(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

export function UndoSessionPanel({
  writeAllowed,
  refreshKey = 0,
}: {
  writeAllowed: boolean | null;
  /** Bump after logging so the panel reloads. */
  refreshKey?: number;
}) {
  const [session, setSession] = useState<UndoSessionPreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    if (writeAllowed !== true) {
      setSession(null);
      setConfirming(false);
      return;
    }
    fetch("/api/games/undo")
      .then(async (r) => {
        if (r.status === 403) {
          setSession(null);
          return;
        }
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Could not load undo.");
        setSession(data.session ?? null);
      })
      .catch(() => setSession(null));
  }, [writeAllowed]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [session]);

  const remainingMs = session
    ? Math.max(
        0,
        new Date(session.expiresAt).getTime() - Date.now()
      )
    : 0;

  useEffect(() => {
    if (session && remainingMs <= 0) {
      setSession(null);
      setConfirming(false);
    }
  }, [session, remainingMs, tick]);

  if (writeAllowed !== true || !session || session.games.length === 0) {
    return null;
  }

  async function runUndo() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/games/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameIds: session.games.map((g) => g.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Undo failed.");
      setSession(data.preview ?? null);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Undo failed.");
    } finally {
      setLoading(false);
    }
  }

  const n = session.games.length;
  const undoLabel =
    n === 1 ? "Undo last game" : `Undo last ${n} games`;

  return (
    <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--field-bg)] p-3.5 sm:p-4">
      {!confirming ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--foreground)]">
              {undoLabel}
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Window closes in {formatRemaining(remainingMs)}. Ratings rewind
              to before {n === 1 ? "that log" : "these logs"}.
            </p>
          </div>
          <button
            type="button"
            className="chip"
            onClick={() => {
              setError(null);
              setConfirming(true);
            }}
          >
            Review…
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Confirm undo
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              These will be removed and Elo / records rewind using what was
              stored when they were logged. Newest first:
            </p>
          </div>

          <ol className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
            {session.games.map((g, i) => (
              <li
                key={g.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <span className="font-medium text-[var(--foreground)]">
                  <span className="mr-2 text-xs text-[var(--muted)]">
                    {i + 1}.
                  </span>
                  {g.label}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {g.scoreline} · {g.format}
                </span>
              </li>
            ))}
          </ol>

          {error && (
            <p className="text-sm text-[var(--danger)]">{error}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={loading}
              onClick={runUndo}
            >
              {loading
                ? "Undoing…"
                : n === 1
                  ? "Yes, undo this game"
                  : `Yes, undo these ${n} games`}
            </button>
            <button
              type="button"
              className="chip"
              disabled={loading}
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
