import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { FeedSimulator } from "@/components/analytics/feed-simulator";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getComparaisonAliments } from "@/lib/queries/analytics";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";

export default async function AnalyticsSimulationPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.STOCK_VOIR);
  if (!permissions) return <AccessDenied />;

  const comparaison = await getComparaisonAliments(session.activeSiteId);

  return (
    <>
      <Header title="Simulateur aliments" />
      <div className="flex flex-col gap-4 p-4">
        {comparaison.aliments.length < 2 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Il faut au moins 2 aliments utilises pour lancer une simulation.
          </p>
        ) : (
          <FeedSimulator aliments={comparaison.aliments} />
        )}

        <div className="pb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/analytics/aliments">
              <ArrowLeft className="h-4 w-4" />
              Retour a la comparaison
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
