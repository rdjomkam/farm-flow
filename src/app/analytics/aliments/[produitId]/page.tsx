import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  FeedDetailSummary,
  FeedFCRChart,
  FeedFCRHebdoChart,
  FeedVagueBreakdown,
  FeedDetailMeta,
  FeedMortaliteCorrelation,
} from "@/components/analytics/feed-detail-charts";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import {
  getDetailAliment,
  getFCRHebdomadaire,
  getChangementsGranule,
} from "@/lib/queries/analytics";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";

export default async function AnalyticsAlimentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ produitId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.STOCK_VOIR);
  if (!permissions) return <AccessDenied />;

  const { produitId } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const vagueIdParam = typeof resolvedSearch?.vagueId === "string" ? resolvedSearch.vagueId : undefined;

  const [detail, fcrHebdo, changementsGranule] = await Promise.all([
    getDetailAliment(session.activeSiteId, produitId),
    getFCRHebdomadaire(session.activeSiteId, produitId, vagueIdParam),
    vagueIdParam
      ? getChangementsGranule(session.activeSiteId, produitId, vagueIdParam)
      : Promise.resolve([]),
  ]);

  const t = await getTranslations("analytics.page");

  if (!detail) {
    return (
      <>
        <Header title={t("alimDetail")} />
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

        {/* FC.7 — FCR hebdomadaire */}
        <FeedFCRHebdoChart points={fcrHebdo} changements={changementsGranule} />

        <FeedFCRChart evolutionFCR={detail.evolutionFCR} />
        <FeedVagueBreakdown parVague={detail.parVague} />

        {/* FC.8 — Corrélation mortalité */}
        <FeedMortaliteCorrelation parVague={detail.parVague} />

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
