import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardStats } from "@/components/ingenieur/dashboard-stats";
import { ClientCard } from "@/components/ingenieur/client-card";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getIngenieurDashboardMetrics, getClientsIngenieur } from "@/lib/queries/ingenieur";
import { Permission, StatutAlerte } from "@/types";
import { prisma } from "@/lib/db";
import {
  typeAlerteLabels,
  severiteAlerte,
  sortAlertesBySeverite,
} from "@/lib/ingenieur/alerte-helpers";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function IngenieurPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.MONITORING_CLIENTS);
  if (!permissions) return <AccessDenied />;

  // Charger metriques + clients + alertes actives des sites clients
  const [metrics, clientsResult] = await Promise.all([
    getIngenieurDashboardMetrics(session.activeSiteId),
    getClientsIngenieur(session.activeSiteId, 1, 50),
  ]);

  // Charger les alertes actives des sites clients
  const clientSiteIds = clientsResult.clients.map((c) => c.siteId);
  const alertesActives = clientSiteIds.length > 0
    ? await prisma.notification.findMany({
        where: {
          siteId: { in: clientSiteIds },
          statut: StatutAlerte.ACTIVE,
        },
        include: {
          site: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  // Trier alertes par sévérité
  const alertesTriees = sortAlertesBySeverite(alertesActives);

  // Serialiser pour passer en props
  const clientsSerialized = JSON.parse(JSON.stringify(clientsResult.clients));
  const metricsSerialized = JSON.parse(JSON.stringify(metrics));

  return (
    <>
      <Header title="Monitoring clients" />

      <div className="flex flex-col gap-6 p-4">

        {/* Alertes actives — section haute */}
        {alertesTriees.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-danger" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Alertes actives ({alertesTriees.length})
              </h2>
            </div>
            <div className="flex flex-col gap-2">
              {alertesTriees.map((alerte) => {
                const sev = severiteAlerte[alerte.typeAlerte] ?? "info";
                return (
                  <Card
                    key={alerte.id}
                    className=""
                  >
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
                          {sev === "critique" || sev === "attention" ? (
                            <AlertTriangle className="h-4 w-4" />
                          ) : (
                            <Bell className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-sm font-medium leading-tight">{alerte.titre}</p>
                            <Badge variant="default" className="shrink-0">
                              {typeAlerteLabels[alerte.typeAlerte] ?? alerte.typeAlerte}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {alerte.message}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <Link
                              href={`/monitoring/${alerte.siteId}`}
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              {(alerte as typeof alerte & { site?: { name: string } }).site?.name ?? alerte.siteId}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              {new Date(alerte.createdAt).toLocaleDateString("fr-FR")}
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
        )}

        {alertesTriees.length === 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-3">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <p className="text-sm text-success font-medium">Aucune alerte active sur les sites clients.</p>
          </div>
        )}

        {/* Liste clients */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Clients ({clientsResult.total})
            </h2>
          </div>

          {clientsSerialized.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center p-4">
                <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Aucun client actif pour le moment.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Les clients apparaissent ici lorsqu&#39;un pack est active pour leur site.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {clientsSerialized.map((client: typeof clientsSerialized[number]) => (
                <ClientCard key={client.siteId} client={client} />
              ))}
            </div>
          )}
        </section>

        {/* Stats globales — bas de page */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Vue globale
          </h2>
          <DashboardStats metrics={metricsSerialized} />
        </section>

      </div>
    </>
  );
}
