import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  FeedDetailSummary,
  FeedFCRChart,
  FeedVagueBreakdown,
  FeedDetailMeta,
} from "@/components/analytics/feed-detail-charts";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getDetailAliment } from "@/lib/queries/analytics";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";

export default async function AnalyticsAlimentDetailPage({
  params,
}: {
  params: Promise<{ produitId: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.STOCK_VOIR);
  if (!permissions) return <AccessDenied />;

  const { produitId } = await params;
  const detail = await getDetailAliment(session.activeSiteId, produitId);

  if (!detail) {
    return (
      <>
        <Header title="Detail aliment" />
        <div className="p-4">
          <p className="py-8 text-center text-sm text-muted-foreground">
            Produit aliment introuvable.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={detail.produitNom} />
      <div className="flex flex-col gap-4 p-4">
        <FeedDetailMeta detail={detail} />
        <FeedDetailSummary detail={detail} />
        <FeedFCRChart evolutionFCR={detail.evolutionFCR} />
        <FeedVagueBreakdown parVague={detail.parVague} />

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
