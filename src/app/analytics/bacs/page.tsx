import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { BacComparisonCards } from "@/components/analytics/bac-comparison-cards";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getComparaisonBacs } from "@/lib/queries/analytics";
import { getVagues } from "@/lib/queries/vagues";
import { StatutVague, Permission } from "@/types";
import { AccessDenied } from "@/components/ui/access-denied";

export default async function AnalyticsBacsPage({
  searchParams,
}: {
  searchParams: Promise<{ vagueId?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.VAGUES_VOIR);
  if (!permissions) return <AccessDenied />;

  const { vagueId } = await searchParams;

  // If no vagueId, show vague selector
  if (!vagueId) {
    const vagues = await getVagues(session.activeSiteId, {
      statut: StatutVague.EN_COURS,
    });

    return (
      <>
        <Header title="Analytiques par bac" />
        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            Selectionnez une vague pour voir la comparaison des bacs.
          </p>
          {vagues.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune vague en cours.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {vagues.map((v) => (
                <Link
                  key={v.id}
                  href={`/analytics/bacs?vagueId=${v.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold">{v.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {v._count.bacs} bac{v._count.bacs > 1 ? "s" : ""} —{" "}
                      {v.nombreInitial} alevins
                    </p>
                  </div>
                  <span className="text-xs text-primary">Comparer →</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  const comparaison = await getComparaisonBacs(session.activeSiteId, vagueId);

  if (!comparaison) {
    return (
      <>
        <Header title="Analytiques par bac" />
        <div className="p-4">
          <p className="py-8 text-center text-sm text-muted-foreground">
            Vague introuvable.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={`Bacs — ${comparaison.vagueCode}`} />
      <div className="flex flex-col gap-4 p-4">
        <BacComparisonCards
          bacs={comparaison.bacs}
          alertes={comparaison.alertes}
          meilleurFCR={comparaison.meilleurFCR}
          meilleurSurvie={comparaison.meilleurSurvie}
        />

        <div className="pb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/analytics/bacs">
              <ArrowLeft className="h-4 w-4" />
              Changer de vague
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
