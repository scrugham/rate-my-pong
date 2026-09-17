"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          name: name.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send feedback.");
      setSuccess(true);
      setMessage("");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send feedback.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-5">
      <label className="block">
        <span className="label">Message</span>
        <textarea
          className="field min-h-[140px] resize-y"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ideas, bugs, table etiquette complaints…"
          required
          maxLength={2000}
        />
        <span className="mt-1 block text-xs text-[var(--muted)]">
          {message.length}/2000
        </span>
      </label>

      <label className="block">
        <span className="label">Name (optional)</span>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="So we know who to thank"
          maxLength={64}
        />
      </label>

      {error && (
        <p className="rounded-lg border border-[rgba(177,35,115,0.35)] bg-[rgba(177,35,115,0.08)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-[rgba(0,175,212,0.3)] bg-[rgba(0,175,212,0.08)] px-3 py-2 text-sm text-[var(--foreground)]">
          Got it. Thanks for the note.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Sending…" : "Send feedback"}
        </button>
        <Link href="/" className="text-sm text-[var(--cyan)] underline">
          Back home
        </Link>
      </div>
    </form>
  );
}
