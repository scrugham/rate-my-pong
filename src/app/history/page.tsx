import { HistoryView } from "@/components/HistoryView";

export default function HistoryPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
          History
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Every match. Filter by player, format, and result type.
        </p>
      </div>

      <div className="panel p-4 sm:p-5">
        <HistoryView />
      </div>
    </section>
  );
}
