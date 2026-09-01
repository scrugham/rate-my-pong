import { AnalyticsView } from "@/components/AnalyticsView";

export default function AnalyticsPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
          Stats
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Slice by format, player, head-to-head, and result type.
        </p>
      </div>

      <div className="panel p-4 sm:p-5">
        <AnalyticsView />
      </div>
    </section>
  );
}
