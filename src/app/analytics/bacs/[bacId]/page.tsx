import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  BacDetailSummary,
  BacDetailMeta,
  BacHistoriqueChart,
} from "@/components/analytics/bac-detail-charts";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getIndicateursBac, getHistoriqueBac } from "@/lib/queries/analytics";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";

export default async function AnalyticsBacDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ bacId: string }>;
  searchParams: Promise<{ vagueId?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.VAGUES_VOIR);
  if (!permissions) return <AccessDenied />;

  const { bacId } = await params;
  const { vagueId } = await searchParams;

  if (!vagueId) {
    return (
      <>
        <Header title="Detail bac" />
        <div className="p-4">
          <p className="py-8 text-center text-sm text-muted-foreground">
            Parametre vagueId manquant.
          </p>
        </div>
      </>
    );
  }

  const [indicateurs, historique] = await Promise.all([
    getIndicateursBac(session.activeSiteId, vagueId, bacId),
    getHistoriqueBac(session.activeSiteId, bacId),
  ]);

  if (!indicateurs) notFound();

  return (
    <>
      <Header title={indicateurs.bacNom} />
      <div className="flex flex-col gap-4 p-4">
        {/* Metadata */}
        <BacDetailMeta indicateurs={indicateurs} />

        {/* Indicateurs summary */}
        <BacDetailSummary indicateurs={indicateurs} />

        {/* Historique cycles */}
        {historique && (
          <BacHistoriqueChart cycles={historique.cycles} />
        )}

        {/* Cross-reference to vague-level analytics */}
        <p className="text-xs text-muted-foreground">
          Pour FCR, SGR et survie,{" "}
          <Link href="/analytics/vagues" className="text-primary hover:underline font-medium">
            voir les indicateurs de performance par vague
          </Link>
          .
        </p>

        {/* Retour */}
        <div className="pb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/analytics/bacs?vagueId=${vagueId}`}>
              <ArrowLeft className="h-4 w-4" />
              Retour a la comparaison
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
