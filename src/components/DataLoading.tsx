"use client";

/** Shared muted loading line for client data views. */
export function DataLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <p className="text-sm text-[var(--muted)]" role="status" aria-live="polite">
      {label}
    </p>
  );
}
