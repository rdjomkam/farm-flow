import { redirect } from "next/navigation";
import Link from "next/link";
import { Calculator, AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { FeedComparisonCards } from "@/components/analytics/feed-comparison-cards";
import { FeedKComparisonChart } from "@/components/analytics/feed-k-comparison-chart";
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
import { getKParAliment } from "@/lib/queries/gompertz-analytics";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission, TailleGranule, PhaseElevage, FormeAliment } from "@/types";

interface AnalyticsAlimentsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AnalyticsAlimentsPage({
  searchParams,
}: AnalyticsAlimentsPageProps) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  try {
  const permissions = await checkPagePermission(session, Permission.STOCK_VOIR);
  if (!permissions) return <AccessDenied />;

  const tAnalytics = await getTranslations("analytics");

  // FD.3 — lire les filtres depuis les searchParams
  const params = await searchParams;
  const rawSaison = typeof params?.saison === "string" ? params.saison : undefined;
  const rawPhase = typeof params?.phase === "string" ? params.phase : undefined;
  const rawTaille = typeof params?.taille === "string" ? params.taille : undefined;
  const rawForme = typeof params?.forme === "string" ? params.forme : undefined;

  const saisonFilter =
    rawSaison === "SECHE" || rawSaison === "PLUIES" ? rawSaison : undefined;
  const phaseFilter =
    rawPhase && Object.values(PhaseElevage).includes(rawPhase as PhaseElevage)
      ? (rawPhase as PhaseElevage)
      : undefined;
  const tailleFilter =
    rawTaille && Object.values(TailleGranule).includes(rawTaille as TailleGranule)
      ? (rawTaille as TailleGranule)
      : undefined;
  const formeFilter =
    rawForme && Object.values(FormeAliment).includes(rawForme as FormeAliment)
      ? (rawForme as FormeAliment)
      : undefined;

  const filtres =
    saisonFilter || phaseFilter || tailleFilter || formeFilter
      ? { saison: saisonFilter, phase: phaseFilter, tailleGranule: tailleFilter, formeAliment: formeFilter }
      : undefined;

  const [comparaison, dlcData, alertesRation, scoresFournisseurs, kParAliment] = await Promise.all([
    getComparaisonAliments(session.activeSiteId, filtres),
    getMouvementsExpirables(session.activeSiteId),
    getAlertesRation(session.activeSiteId),
    getScoresFournisseurs(session.activeSiteId),
    getKParAliment(session.activeSiteId),
  ]);

  // G3.3 — Merge K Gompertz data into aliments and determine best K produitId
  const kParAlimentMap = new Map(kParAliment.map((k) => [k.produitId, k]));
  const alimentsAvecK = comparaison.aliments.map((aliment) => {
    const kData = kParAlimentMap.get(aliment.produitId);
    if (!kData) return aliment;
    return {
      ...aliment,
      kMoyenGompertz: kData.kMoyen,
      kNiveauGompertz: kData.kNiveau,
    };
  });

  // Meilleur K = produit avec le kMoyen le plus eleve (parmi ceux ayant des donnees)
  let meilleurK: string | null = null;
  if (kParAliment.length >= 2) {
    const best = kParAliment.reduce((a, b) => (b.kMoyen > a.kMoyen ? b : a));
    meilleurK = best.produitId;
  }

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
          aliments={alimentsAvecK}
          meilleurFCR={comparaison.meilleurFCR}
          meilleurCoutKg={comparaison.meilleurCoutKg}
          meilleurSGR={comparaison.meilleurSGR}
          meilleurK={meilleurK}
        />

        {/* G3.3 — Graphique comparaison K Gompertz (conditionnel, min 2 aliments avec K) */}
        <FeedKComparisonChart aliments={alimentsAvecK} />

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
  } catch (error: unknown) {
    const digest = error instanceof Error && "digest" in error ? (error as Record<string, unknown>).digest : undefined;
    if (typeof digest === "string" && /^[A-Z_]/.test(digest)) throw error;
    console.error("[AnalyticsAlimentsPage]", error);
    throw error;
  }
}
