import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
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
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.VAGUES_VOIR);
  if (!permissions) return <AccessDenied />;

  const { vagueId } = await searchParams;
  const t = await getTranslations("analytics.page");

  // If no vagueId, show vague selector
  if (!vagueId) {
    const { data: vagues } = await getVagues(session.activeSiteId, {
      statut: StatutVague.EN_COURS,
    });

    return (
      <>
        <Header title={t("bacAnalytics")} />
        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            {t("selectWave")}
          </p>
          {vagues.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noWaveInProgress")}
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
                      {v._count.bacs > 1 ? t("waveSummaryBacsPlural", { count: v._count.bacs }) : t("waveSummaryBacs", { count: v._count.bacs })} —{" "}
                      {t("waveSummaryAlevins", { count: v.nombreInitial })}
                    </p>
                  </div>
                  <span className="text-xs text-primary">{t("comparer")}</span>
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
        <Header title={t("bacAnalytics")} />
        <div className="p-4">
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("waveNotFound")}
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
        />

        <div className="pb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/analytics/bacs">
              <ArrowLeft className="h-4 w-4" />
              {t("changerVague")}
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
