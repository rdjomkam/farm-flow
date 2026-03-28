import { redirect } from "next/navigation";
import Link from "next/link";
import { Calculator, AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { FeedComparisonCards } from "@/components/analytics/feed-comparison-cards";
import { RecommendationCard } from "@/components/analytics/recommendation-card";
import { FeedFilters } from "@/components/analytics/feed-filters";
import { AlerteDLC } from "@/components/analytics/alerte-dlc";
import { AlerteRationCard } from "@/components/analytics/alerte-ration-card";
import { ScoreFournisseursCard } from "@/components/analytics/score-fournisseurs-card";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import {
  getComparaisonAliments,
  getMouvementsExpirables,
  getAlertesRation,
  getScoresFournisseurs,
} from "@/lib/queries/analytics";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission, TailleGranule } from "@/types";

interface AnalyticsAlimentsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AnalyticsAlimentsPage({
  searchParams,
}: AnalyticsAlimentsPageProps) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.STOCK_VOIR);
  if (!permissions) return <AccessDenied />;

  const tAnalytics = await getTranslations("analytics");

  // FD.3 — lire le filtre saison depuis les searchParams
  const params = await searchParams;
  const rawSaison = typeof params?.saison === "string" ? params.saison : undefined;
  const saisonFilter =
    rawSaison === "SECHE" || rawSaison === "PLUIES" ? rawSaison : undefined;

  const [comparaison, dlcData, alertesRation, scoresFournisseurs] = await Promise.all([
    getComparaisonAliments(session.activeSiteId, saisonFilter ? { saison: saisonFilter } : undefined),
    getMouvementsExpirables(session.activeSiteId),
    getAlertesRation(session.activeSiteId),
    getScoresFournisseurs(session.activeSiteId),
  ]);

  // FC.4 — detect mixed granule sizes
  const tailles = new Set(
    comparaison.aliments
      .map((a) => a.tailleGranule)
      .filter((t): t is TailleGranule => t !== null)
  );
  const hasMixedSizes = tailles.size > 1;

  return (
    <>
      <Header title="Analytiques aliments" />
      <div className="flex flex-col gap-4 p-4">
        {/* FC.9 — Alertes DLC */}
        <AlerteDLC expires={dlcData.expires} expiringSoon={dlcData.expiringSoon} />

        {/* FD.1 — Alertes sous/sur-alimentation */}
        <AlerteRationCard alertes={alertesRation} />

        {/* FC.2 — Filters */}
        <FeedFilters />

        {/* FC.4 — Mixed sizes warning */}
        {hasMixedSizes && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm">{tAnalytics("avertissement.taillesDifferentes")}</p>
          </div>
        )}

        <RecommendationCard recommandation={comparaison.recommandation} />

        <FeedComparisonCards
          aliments={comparaison.aliments}
          meilleurFCR={comparaison.meilleurFCR}
          meilleurCoutKg={comparaison.meilleurCoutKg}
          meilleurSGR={comparaison.meilleurSGR}
        />

        {/* FD.2 — Performance par fournisseur */}
        <ScoreFournisseursCard fournisseurs={scoresFournisseurs} />

        {comparaison.aliments.length >= 2 && (
          <div className="pb-4">
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link href="/analytics/aliments/simulation">
                <Calculator className="h-4 w-4" />
                Simuler un changement d&apos;aliment
              </Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
