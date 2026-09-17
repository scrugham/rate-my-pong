"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DataLoading } from "@/components/DataLoading";
import type { Feedback } from "@/lib/types";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function FeedbackInbox() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/write-access").then((r) => r.json()),
      fetch("/api/feedback"),
    ])
      .then(async ([access, res]) => {
        if (!access.allowed) {
          setDenied(true);
          return;
        }
        if (res.status === 403) {
          setDenied(true);
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Could not load inbox.");
        }
        setItems(data.feedback ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load inbox.");
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <DataLoading />;

  if (denied) {
    return (
      <div className="space-y-4">
        <p
          className="rounded-lg border border-[rgba(242,169,0,0.35)] bg-[rgba(242,169,0,0.08)] px-3 py-2 text-sm text-[var(--foreground)]"
          role="status"
          aria-live="polite"
        >
          Looks like you’re outside the allowed network. Switch to office Wi‑Fi
          (or open this at the office) to read feedback.
        </p>
        <Link href="/feedback" className="text-sm text-[var(--cyan)] underline">
          Submit feedback instead
        </Link>
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-[var(--danger)]">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        {items.length} note{items.length === 1 ? "" : "s"} · newest first
      </p>
      <ul className="divide-y divide-[var(--border)]">
        {items.map((item) => (
          <li key={item.id} className="py-4">
            <p className="whitespace-pre-wrap text-sm text-[var(--foreground)]">
              {item.message}
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {item.name ? item.name : "Anonymous"} · {formatWhen(item.createdAt)}
            </p>
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-10 text-center text-sm text-[var(--muted)]">
            Inbox is empty.
          </li>
        )}
      </ul>
      <Link href="/feedback" className="text-sm text-[var(--cyan)] underline">
        Feedback form
      </Link>
    </div>
  );
}
