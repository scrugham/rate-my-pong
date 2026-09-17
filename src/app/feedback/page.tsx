import { FeedbackForm } from "@/components/FeedbackForm";

export default function FeedbackPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
          Feedback
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Ideas, bugs, or anything else about Rate My Pong.
        </p>
      </div>

      <div className="panel p-4 sm:p-6">
        <FeedbackForm />
      </div>
    </section>
  );
}
