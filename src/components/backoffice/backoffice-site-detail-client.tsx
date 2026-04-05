"use client";

/**
 * BackofficeSiteDetailClient — detail d'un site dans le backoffice.
 *
 * Identique a AdminSiteDetailClient mais utilise les composants backoffice
 * (BackofficeSiteStatusDialog, BackofficeSiteModulesEditor) avec /api/backoffice/ URLs.
 *
 * Story C.6 — ADR-022 Backoffice
 */

import { formatNumber } from "@/lib/format";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Users, Layers, Database, CheckCircle, XCircle } from "lucide-react";
import { SiteStatus, SiteModule } from "@/types";
import type { AdminSiteDetailResponse } from "@/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminSiteStatusBadge } from "@/components/admin/sites/admin-site-status-badge";
import { AdminSiteAuditLog } from "@/components/admin/sites/admin-site-audit-log";
import { BackofficeSiteStatusDialog } from "./backoffice-site-status-dialog";
import { BackofficeSiteModulesEditor } from "./backoffice-site-modules-editor";
import { Button } from "@/components/ui/button";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function SiteInfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span
        className={`text-sm text-right text-foreground truncate ${mono ? "font-mono text-xs" : "font-medium"}`}
      >
        {value}
      </span>
    </div>
  );
}

interface BackofficeSiteDetailClientProps {
  site: AdminSiteDetailResponse;
}

export function BackofficeSiteDetailClient({ site: initialSite }: BackofficeSiteDetailClientProps) {
  const t = useTranslations("backoffice");
  const [site, setSite] = useState(initialSite);

  function handleModulesSaved(modules: SiteModule[]) {
    setSite((prev) => ({ ...prev, enabledModules: modules }));
  }

  function handleStatusChanged() {
    window.location.reload();
  }

  const canChangeStatus = site.status !== SiteStatus.ARCHIVED;

  return (
    <div className="space-y-6">
      {/* Header avec statut + actions rapides */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Building2 className="h-6 w-6 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{site.name}</h1>
            {site.address && (
              <p className="text-sm text-muted-foreground truncate">{site.address}</p>
            )}
          </div>
          <AdminSiteStatusBadge status={site.status} className="shrink-0" />
        </div>

        {canChangeStatus && (
          <BackofficeSiteStatusDialog
            siteId={site.id}
            siteName={site.name}
            currentStatus={site.status}
            trigger={
              <Button variant="outline" size="sm">
                Changer le statut
              </Button>
            }
            onSuccess={handleStatusChanged}
          />
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resume">
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="resume">{t("sites.detail.tabs.summary")}</TabsTrigger>
          <TabsTrigger value="modules">{t("sites.detail.tabs.modules")}</TabsTrigger>
          <TabsTrigger value="membres">{t("sites.detail.tabs.members")}</TabsTrigger>
          <TabsTrigger value="abonnement">{t("sites.detail.tabs.subscription")}</TabsTrigger>
          <TabsTrigger value="audit">{t("sites.detail.tabs.audit")}</TabsTrigger>
        </TabsList>

        {/* Resume */}
        <TabsContent value="resume">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Bacs" value={site.bacCount} icon={<Database className="h-5 w-5" />} />
              <StatCard label="Vagues" value={site.vagueCount} icon={<Layers className="h-5 w-5" />} />
              <StatCard label="Releves" value={site.releveCount} icon={<CheckCircle className="h-5 w-5" />} />
              <StatCard label="Membres" value={site.memberCount} icon={<Users className="h-5 w-5" />} />
            </div>

            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              <SiteInfoRow label="ID" value={site.id} mono />
              <SiteInfoRow label="Nom" value={site.name} />
              <SiteInfoRow label="Adresse" value={site.address ?? "—"} />
              <SiteInfoRow label={t("sites.supervise")} value={site.supervised ? "Oui" : "Non"} />
              <SiteInfoRow
                label={t("sites.creeLe")}
                value={new Date(site.createdAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              />
              <SiteInfoRow
                label={t("sites.modifieLe")}
                value={new Date(site.updatedAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              />
              {site.suspendedAt && (
                <SiteInfoRow
                  label="Suspendu le"
                  value={new Date(site.suspendedAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                />
              )}
              {site.suspendedReason && (
                <SiteInfoRow label="Raison suspension" value={site.suspendedReason} />
              )}
            </div>
          </div>
        </TabsContent>

        {/* Modules */}
        <TabsContent value="modules">
          <BackofficeSiteModulesEditor
            siteId={site.id}
            enabledModules={site.enabledModules}
            onSaved={handleModulesSaved}
          />
        </TabsContent>

        {/* Membres */}
        <TabsContent value="membres">
          <div className="space-y-3">
            {site.members.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">{t("sites.aucunMembre")}</p>
              </div>
            ) : (
              <>
                {/* Mobile */}
                <div className="space-y-2 md:hidden">
                  {site.members.map((m) => (
                    <div key={m.id} className="rounded-xl border border-border bg-card p-4 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{m.name}</p>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                          {m.siteRoleName}
                        </span>
                      </div>
                      {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                      {m.phone && <p className="text-xs text-muted-foreground">{m.phone}</p>}
                    </div>
                  ))}
                </div>

                {/* Desktop */}
                <div className="hidden md:block rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">{t("sites.detail.table.name")}</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">{t("sites.detail.table.email")}</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">{t("sites.detail.table.phone")}</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">{t("sites.detail.table.role")}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {site.members.map((m) => (
                        <tr key={m.id}>
                          <td className="px-4 py-3 text-sm font-medium text-foreground">{m.name}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{m.email ?? "—"}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{m.phone ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                              {m.siteRoleName}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Abonnement */}
        <TabsContent value="abonnement">
          {!site.abonnementActif ? (
            <div className="flex flex-col items-center py-10 text-center">
              <XCircle className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">{t("sites.aucunAbonnementActif")}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              <SiteInfoRow label="Plan" value={site.abonnementActif.planNom} />
              <SiteInfoRow label="Type" value={site.abonnementActif.typePlan} />
              <SiteInfoRow label="Statut" value={site.abonnementActif.statut} />
              <SiteInfoRow label={t("sites.periode")} value={site.abonnementActif.periode} />
              <SiteInfoRow
                label={t("sites.debut")}
                value={new Date(site.abonnementActif.dateDebut).toLocaleDateString("fr-FR", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
              />
              <SiteInfoRow
                label="Fin"
                value={new Date(site.abonnementActif.dateFin).toLocaleDateString("fr-FR", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
              />
              {site.abonnementActif.dateFinGrace && (
                <SiteInfoRow
                  label={t("sites.finDeGrace")}
                  value={new Date(site.abonnementActif.dateFinGrace).toLocaleDateString("fr-FR", {
                    day: "2-digit", month: "long", year: "numeric",
                  })}
                />
              )}
              <SiteInfoRow
                label={t("sites.prixPaye")}
                value={`${formatNumber(site.abonnementActif.prixPaye)} XAF`}
              />
            </div>
          )}
        </TabsContent>

        {/* Audit */}
        <TabsContent value="audit">
          <AdminSiteAuditLog logs={site.recentAuditLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
