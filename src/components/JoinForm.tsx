"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

export function JoinForm() {
  const [nickname, setNickname] = useState("");
  const [realName, setRealName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [writeAllowed, setWriteAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/write-access")
      .then((r) => r.json())
      .then((d) => setWriteAllowed(Boolean(d.allowed)))
      .catch(() => setWriteAllowed(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (writeAllowed === false) {
      setError(
        "Looks like you’re outside the allowed network. Switch to office Wi‑Fi (or open this at the office) to add a player."
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, realName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not join.");
      setSuccess(
        `${data.player.nickname} - ${data.player.realName} joined at ${data.player.elo} ELO.`
      );
      setNickname("");
      setRealName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-5">
      <label className="block">
        <span className="label">Nickname</span>
        <input
          className="field"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Miso Homie"
          required
          maxLength={32}
          disabled={writeAllowed === false}
        />
      </label>

      <label className="block">
        <span className="label">Real name</span>
        <input
          className="field"
          value={realName}
          onChange={(e) => setRealName(e.target.value)}
          placeholder="Clayton"
          required
          maxLength={64}
          disabled={writeAllowed === false}
        />
      </label>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-3">
        <p className="text-xs text-[var(--muted)]">Shows on the board as</p>
        <p className="mt-1.5 truncate text-sm font-medium text-[var(--foreground)]">
          {(nickname.trim() || "Nickname") +
            " - " +
            (realName.trim() || "Real Name")}
        </p>
      </div>

      {writeAllowed === false && (
        <p
          className="rounded-lg border border-[rgba(242,169,0,0.35)] bg-[rgba(242,169,0,0.08)] px-3 py-2 text-sm text-[var(--foreground)]"
          role="status"
          aria-live="polite"
        >
          Looks like you’re outside the allowed network. Switch to office
          Wi‑Fi (or open this at the office) to add a player.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-[rgba(177,35,115,0.35)] bg-[rgba(177,35,115,0.08)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-[rgba(0,175,212,0.3)] bg-[rgba(0,175,212,0.08)] px-3 py-2 text-sm text-[var(--foreground)]">
          {success}{" "}
          <Link href="/" className="text-[var(--cyan)] underline">
            Log a match
          </Link>
        </p>
      )}

      <div className="pt-3">
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading || writeAllowed === false}
        >
          {loading ? "Joining..." : "Join"}
        </button>
      </div>
    </form>
  );
}
