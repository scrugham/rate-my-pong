import { JoinForm } from "@/components/JoinForm";

export default function JoinPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
          Add Player
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Nickname - Real Name, then they show up in the match log.
        </p>
      </div>

      <div className="panel p-5 sm:p-6">
        <JoinForm />
      </div>
    </section>
  );
}
