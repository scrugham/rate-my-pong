import { FeedbackInbox } from "@/components/FeedbackInbox";

export default function FeedbackInboxPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
          Feedback inbox
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Office network only. Same gate as logging matches.
        </p>
      </div>

      <div className="panel p-4 sm:p-6">
        <FeedbackInbox />
      </div>
    </section>
  );
}
