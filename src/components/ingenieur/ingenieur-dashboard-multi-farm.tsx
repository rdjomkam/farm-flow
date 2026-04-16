/**
 * IngenieurDashboardMultiFarm — mode hub (activeSiteId = null ou site DKFarm)
 *
 * Affiche :
 * - Hero avec salutation + résumé global
 * - Alertes actives sur tous les sites clients
 * - Tâches du jour
 * - Liste des fermes supervisées (ClientCard)
 * - Résumé du portefeuille commissions
 *
 * Sprint ID — Story ID.1
 * R6 : CSS variables du thème
 */

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Users,
  Wallet,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardStats } from "@/components/ingenieur/dashboard-stats";
import { ClientCard } from "@/components/ingenieur/client-card";
import { getIngenieurDashboardMetrics, getClientsIngenieur } from "@/lib/queries/ingenieur";
import { getPortefeuille } from "@/lib/queries/commissions";
import { StatutAlerte } from "@/types";
import { prisma } from "@/lib/db";
import {
  typeAlerteLabels,
  severiteAlerte,
  sortAlertesBySeverite,
  type AlerteSeverite,
} from "@/lib/ingenieur/alerte-helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-CM", {
    style: "currency",
    currency: "XAF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IngenieurDashboardMultiFarmProps {
  vendeurSiteId: string;
  userId: string;
  sessionName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export async function IngenieurDashboardMultiFarm({
  vendeurSiteId,
  userId,
  sessionName,
}: IngenieurDashboardMultiFarmProps) {
  const t = await getTranslations("ingenieur");

  // Charger les données en parallèle
  const [metrics, clientsResult, portefeuilleData] = await Promise.all([
    getIngenieurDashboardMetrics(vendeurSiteId),
    getClientsIngenieur(vendeurSiteId, 1, 6),
    getPortefeuille(userId),
  ]);

  // Charger les alertes actives des sites clients
  const clientSiteIds = clientsResult.clients.map((c) => c.siteId);
  const alertesActives =
    clientSiteIds.length > 0
      ? await prisma.notification.findMany({
          where: {
            siteId: { in: clientSiteIds },
            statut: StatutAlerte.ACTIVE,
          },
          include: {
            site: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : [];

  const alertesTriees = sortAlertesBySeverite(alertesActives);

  const clientsSerialized = JSON.parse(JSON.stringify(clientsResult.clients));
  const metricsSerialized = JSON.parse(JSON.stringify(metrics));

  const solde = portefeuilleData.portefeuille
    ? Number(portefeuilleData.portefeuille.solde)
    : 0;
  const soldePending = portefeuilleData.portefeuille
    ? Number(portefeuilleData.portefeuille.soldePending)
    : 0;

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Hero — salutation + résumé global */}
      <section
        className="relative overflow-hidden rounded-2xl p-4 sm:p-6"
        style={{ background: "var(--primary-gradient)" }}
      >
        <div className="relative z-10 text-white">
          <p className="text-sm font-medium text-white/70 capitalize">{today}</p>
          <h1 className="text-xl font-bold mt-1">{t("greeting", { name: sessionName })}</h1>
          <p className="text-sm text-white/80 mt-1">
            {metrics.totalClientsActives} client
            {metrics.totalClientsActives > 1 ? "s" : ""} actif
            {metrics.totalClientsActives > 1 ? "s" : ""}
            {metrics.alertesActives > 0 && (
              <span className="ml-2 inline-flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {metrics.alertesActives} alerte
                {metrics.alertesActives > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 hidden sm:block" />
        <div className="absolute -right-4 bottom-0 h-20 w-20 rounded-full bg-white/5 hidden sm:block" />
      </section>

      {/* Stats globales */}
      <DashboardStats metrics={metricsSerialized} />

      {/* Alertes actives — top 5 */}
      {alertesTriees.length > 0 ? (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-danger" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("monitoring.alertesActives", { count: alertesTriees.length })}
              </h2>
            </div>
            <Link
              href="/monitoring"
              className="text-xs text-primary hover:underline font-medium flex items-center gap-0.5"
            >
              {t("dashboard.toutVoir")} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {alertesTriees.map((alerte) => {
              const sev: AlerteSeverite = severiteAlerte[alerte.typeAlerte] ?? "info";
              return (
                <Card key={alerte.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={
                          sev === "critique"
                            ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-danger bg-danger/10"
                            : sev === "attention"
                            ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-warning bg-warning/10"
                            : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-accent-blue bg-accent-blue-muted"
                        }
                      >
                        {sev === "info" ? (
                          <Bell className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-medium leading-tight">{alerte.titre}</p>
                          <Badge variant="default" className="shrink-0 text-[10px]">
                            {typeAlerteLabels[alerte.typeAlerte] ?? alerte.typeAlerte}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <Link
                            href={`/monitoring/${alerte.siteId}`}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            {(
                              alerte as typeof alerte & {
                                site?: { name: string };
                              }
                            ).site?.name ?? alerte.siteId}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {new Date(alerte.createdAt).toLocaleDateString(
                              "fr-FR"
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-3">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <p className="text-sm text-success font-medium">
            {t("emptyStates.noAlertesActiveClients")}
          </p>
        </div>
      )}

      {/* Fermes supervisées — top 6 */}
      {clientsSerialized.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("dashboard.fermesSuperviseesTitle", { count: clientsResult.total })}
              </h2>
            </div>
            {clientsResult.total > 6 && (
              <Link
                href="/monitoring"
                className="text-xs text-primary hover:underline font-medium flex items-center gap-0.5"
              >
                {t("dashboard.toutVoir")} <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {clientsSerialized.map(
              (client: typeof clientsSerialized[number]) => (
                <ClientCard key={client.siteId} client={client} />
              )
            )}
          </div>
        </section>
      )}

      {/* Portefeuille commissions — résumé compact */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("dashboard.monPortefeuille")}
            </h2>
          </div>
          <Link
            href="/mon-portefeuille"
            className="text-xs text-primary hover:underline font-medium flex items-center gap-0.5"
          >
            {t("dashboard.voirDetails")} <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                {t("dashboard.disponible")}
              </p>
              <p className="text-lg font-bold text-foreground">
                {formatXAF(solde)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                {t("dashboard.enAttente")}
              </p>
              <p className="text-lg font-bold text-warning">
                {formatXAF(soldePending)}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
