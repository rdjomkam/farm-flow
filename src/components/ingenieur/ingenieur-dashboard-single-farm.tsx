/**
 * IngenieurDashboardSingleFarm — mode site client unique
 *
 * Affiche les indicateurs du site client sélectionné :
 * - KPIs zootechniques (survie, vagues actives, bacs)
 * - Alertes actives pour ce client
 * - Tâches du jour sur ce site
 * - Lien vers la fiche détaillée du client
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
  ChevronRight,
  Fish,
  HeartPulse,
  LayoutDashboard,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getClientIngenieurDetail } from "@/lib/queries/ingenieur";
import { getAllMyTasks } from "@/lib/queries";
import { StatutAlerte, StatutActivite } from "@/types";
import { prisma } from "@/lib/db";
import { getDashboardData } from "@/lib/queries/dashboard";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IngenieurDashboardSingleFarmProps {
  /** Site DKFarm de l'ingénieur (vendeur) */
  vendeurSiteId: string;
  /** Site client sélectionné (activeSiteId de la session) */
  clientSiteId: string;
  userId: string;
  sessionName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export async function IngenieurDashboardSingleFarm({
  vendeurSiteId,
  clientSiteId,
  userId,
  sessionName,
}: IngenieurDashboardSingleFarmProps) {
  // Charger en parallèle
  const [t, clientSummary, alertesActives, tasks, dashboardData] =
    await Promise.all([
      getTranslations("ingenieur"),
      getClientIngenieurDetail(vendeurSiteId, clientSiteId),
      prisma.notification.findMany({
        where: {
          siteId: clientSiteId,
          statut: StatutAlerte.ACTIVE,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      getAllMyTasks(clientSiteId, userId),
      getDashboardData(clientSiteId),
    ]);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const tachesAujourdhui = tasks.filter((t) => {
    const debut = new Date(t.dateDebut);
    const now = new Date();
    return (
      t.statut !== StatutActivite.TERMINEE &&
      debut.toDateString() === now.toDateString()
    );
  });

  const siteName = clientSummary?.siteName ?? "Site client";

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Hero — site client sélectionné */}
      <section
        className="relative overflow-hidden rounded-2xl p-4 sm:p-6"
        style={{ background: "var(--primary-gradient)" }}
      >
        <div className="relative z-10 text-white">
          <p className="text-sm font-medium text-white/70 capitalize">{today}</p>
          <h1 className="text-xl font-bold mt-1">{t("greeting", { name: sessionName })}</h1>
          <p className="text-sm text-white/80 mt-1 truncate">
            Vue : {siteName}
          </p>
        </div>
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 hidden sm:block" />
        <div className="absolute -right-4 bottom-0 h-20 w-20 rounded-full bg-white/5 hidden sm:block" />
      </section>

      {/* KPIs zootechniques */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <HeartPulse className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">Survie moy.</span>
            </div>
            <p
              className={`text-lg font-bold ${
                clientSummary?.survieMoyenne === null || clientSummary === null
                  ? "text-muted-foreground"
                  : clientSummary.survieMoyenne >= 90
                  ? "text-success"
                  : clientSummary.survieMoyenne >= 80
                  ? "text-accent-amber"
                  : "text-danger"
              }`}
            >
              {clientSummary?.survieMoyenne !== null && clientSummary !== null
                ? `${clientSummary.survieMoyenne}%`
                : "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Fish className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Vagues</span>
            </div>
            <p className="text-lg font-bold">
              {dashboardData.vaguesActives}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                en cours
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-danger" />
              <span className="text-xs text-muted-foreground">Alertes</span>
            </div>
            <p
              className={`text-lg font-bold ${
                alertesActives.length > 0
                  ? "text-danger"
                  : "text-muted-foreground"
              }`}
            >
              {alertesActives.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <LayoutDashboard className="h-4 w-4 text-accent-blue" />
              <span className="text-xs text-muted-foreground">Bacs</span>
            </div>
            <p className="text-lg font-bold">
              {dashboardData.bacsOccupes}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                /{dashboardData.bacsTotal}
              </span>
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Alertes actives */}
      {alertesActives.length > 0 ? (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-danger" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Alertes ({alertesActives.length})
              </h2>
            </div>
            <Link
              href={`/monitoring/${clientSiteId}`}
              className="text-xs text-primary hover:underline font-medium flex items-center gap-0.5"
            >
              Details <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {alertesActives.map((alerte) => (
              <Card key={alerte.id}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-danger bg-danger/10">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {alerte.titre}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {alerte.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(alerte.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-3">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <p className="text-sm text-success font-medium">
            Aucune alerte active pour ce site.
          </p>
        </div>
      )}

      {/* Tâches du jour */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Taches du jour ({tachesAujourdhui.length})
          </h2>
          <Link
            href="/mes-taches"
            className="text-xs text-primary hover:underline font-medium flex items-center gap-0.5"
          >
            Tout voir <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {tachesAujourdhui.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("emptyStates.noTasksToday")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {tachesAujourdhui.slice(0, 3).map((tache) => (
              <Card key={tache.id}>
                <CardContent className="p-3 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">
                      {tache.titre}
                    </p>
                    {tache.vague && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Vague {tache.vague.code}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={
                      tache.statut === StatutActivite.EN_RETARD
                        ? "annulee"
                        : "en_cours"
                    }
                    className="shrink-0 text-[10px]"
                  >
                    {tache.statut === StatutActivite.EN_RETARD
                      ? t("statuses.late")
                      : "Aujourd'hui"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Lien fiche détaillée du client */}
      <div>
        <Link
          href={`/monitoring/${clientSiteId}`}
          className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          Voir la fiche complete du site
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
