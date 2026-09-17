import { Suspense } from "react";
import { DataLoading } from "@/components/DataLoading";
import { PlayerProfileView } from "@/components/PlayerProfileView";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="panel p-4 sm:p-6">
        <Suspense fallback={<DataLoading />}>
          <PlayerProfileView playerId={id} />
        </Suspense>
      </div>
    </section>
  );
}
