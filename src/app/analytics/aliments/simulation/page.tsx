import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("analytics.page");

  return (
    <>
      <Header title={t("alimSimulator")} />
      <div className="flex flex-col gap-4 p-4">
        {comparaison.aliments.length < 2 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("minTwoFeeds")}
          </p>
        ) : (
          <FeedSimulator aliments={comparaison.aliments} />
        )}

        <div className="pb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/analytics/aliments">
              <ArrowLeft className="h-4 w-4" />
              {t("backToComparison")}
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
