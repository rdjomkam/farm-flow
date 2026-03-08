import { Header } from "@/components/layout/header";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { VagueSummaryCard } from "@/components/dashboard/vague-summary-card";
import { getDashboardData } from "@/lib/queries/dashboard";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <>
      <Header title="Dashboard" />
      <div className="flex flex-col gap-4 p-4">
        <StatsCards data={data} />

        <section>
          <h2 className="mb-3 text-base font-semibold">Vagues en cours</h2>
          {data.vagues.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune vague en cours. Créez une vague pour commencer le suivi.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {data.vagues.map((vague) => (
                <VagueSummaryCard key={vague.id} vague={vague} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
