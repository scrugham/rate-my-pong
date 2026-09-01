import { LogMatchForm } from "@/components/LogMatchForm";
import { PongHeroArt } from "@/components/PongArt";

export default function HomePage() {
  return (
    <div className="relative">
      <PongHeroArt />

      <section className="relative mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
            Rate My Pong
          </h1>
        </div>

        <div className="panel p-5 sm:p-6">
          <LogMatchForm />
        </div>
      </section>
    </div>
  );
}
