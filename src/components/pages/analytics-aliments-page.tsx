import { redirect } from "next/navigation";
import Link from "next/link";
import { Calculator } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { FeedComparisonCards } from "@/components/analytics/feed-comparison-cards";
import { RecommendationCard } from "@/components/analytics/recommendation-card";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getComparaisonAliments } from "@/lib/queries/analytics";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";

export default async function AnalyticsAlimentsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.STOCK_VOIR);
  if (!permissions) return <AccessDenied />;

  const comparaison = await getComparaisonAliments(session.activeSiteId);

  return (
    <>
      <Header title="Analytiques aliments" />
      <div className="flex flex-col gap-4 p-4">
        <RecommendationCard recommandation={comparaison.recommandation} />

        <FeedComparisonCards
          aliments={comparaison.aliments}
          meilleurFCR={comparaison.meilleurFCR}
          meilleurCoutKg={comparaison.meilleurCoutKg}
          meilleurSGR={comparaison.meilleurSGR}
        />

        {comparaison.aliments.length >= 2 && (
          <div className="pb-4">
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link href="/analytics/aliments/simulation">
                <Calculator className="h-4 w-4" />
                Simuler un changement d'aliment
              </Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
