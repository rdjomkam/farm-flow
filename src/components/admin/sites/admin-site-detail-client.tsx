"use client";

/**
 * admin-site-detail-client.tsx
 *
 * Composant client principal pour la page de détail d'un site (admin plateforme).
 * Tabs Radix : Résumé | Modules | Membres | Abonnement | Audit
 *
 * Mobile-first (360px) : cartes empilées.
 * R5 : DialogTrigger asChild sur les dialogs de statut.
 * R6 : CSS variables du thème.
 *
 * ADR-021 section 4.2 — AdminSiteDetailClient.
 */

import { formatNumber } from "@/lib/format";
import { useState } from "react";
import { Building2, Users, Layers, Database, CheckCircle, XCircle } from "lucide-react";
import { SiteStatus, SiteModule } from "@/types";
import type { AdminSiteDetailResponse } from "@/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminSiteStatusBadge } from "./admin-site-status-badge";
import { AdminSiteStatusDialog } from "./admin-site-status-dialog";
import { AdminSiteModulesEditor } from "./admin-site-modules-editor";
import { AdminSiteAuditLog } from "./admin-site-audit-log";
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

interface AdminSiteDetailClientProps {
  site: AdminSiteDetailResponse;
}

export function AdminSiteDetailClient({ site: initialSite }: AdminSiteDetailClientProps) {
  const [site, setSite] = useState(initialSite);

  function handleModulesSaved(modules: SiteModule[]) {
    setSite((prev) => ({ ...prev, enabledModules: modules }));
  }

  function handleStatusChanged() {
    // Recharger les données de la page via un reload léger
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
          <AdminSiteStatusDialog
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
          <TabsTrigger value="resume">Résumé</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="membres">Membres</TabsTrigger>
          <TabsTrigger value="abonnement">Abonnement</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        {/* ── Résumé ─────────────────────────────────────────────────────── */}
        <TabsContent value="resume">
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Bacs" value={site.bacCount} icon={<Database className="h-5 w-5" />} />
              <StatCard label="Vagues" value={site.vagueCount} icon={<Layers className="h-5 w-5" />} />
              <StatCard label="Relevés" value={site.releveCount} icon={<CheckCircle className="h-5 w-5" />} />
              <StatCard label="Membres" value={site.memberCount} icon={<Users className="h-5 w-5" />} />
            </div>

            {/* Infos du site */}
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              <SiteInfoRow label="ID" value={site.id} mono />
              <SiteInfoRow label="Nom" value={site.name} />
              <SiteInfoRow label="Adresse" value={site.address ?? "—"} />
              <SiteInfoRow
                label="Supervisé"
                value={site.supervised ? "Oui" : "Non"}
              />
              <SiteInfoRow
                label="Créé le"
                value={new Date(site.createdAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              />
              <SiteInfoRow
                label="Modifié le"
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

        {/* ── Modules ────────────────────────────────────────────────────── */}
        <TabsContent value="modules">
          <AdminSiteModulesEditor
            siteId={site.id}
            enabledModules={site.enabledModules}
            onSaved={handleModulesSaved}
          />
        </TabsContent>

        {/* ── Membres ────────────────────────────────────────────────────── */}
        <TabsContent value="membres">
          <div className="space-y-3">
            {site.members.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">Aucun membre.</p>
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
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Nom</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Email</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Téléphone</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Rôle</th>
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

        {/* ── Abonnement ─────────────────────────────────────────────────── */}
        <TabsContent value="abonnement">
          {!site.abonnementActif ? (
            <div className="flex flex-col items-center py-10 text-center">
              <XCircle className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">Aucun abonnement actif.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              <SiteInfoRow label="Plan" value={site.abonnementActif.planNom} />
              <SiteInfoRow label="Type" value={site.abonnementActif.typePlan} />
              <SiteInfoRow label="Statut" value={site.abonnementActif.statut} />
              <SiteInfoRow label="Période" value={site.abonnementActif.periode} />
              <SiteInfoRow
                label="Début"
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
                  label="Fin de grâce"
                  value={new Date(site.abonnementActif.dateFinGrace).toLocaleDateString("fr-FR", {
                    day: "2-digit", month: "long", year: "numeric",
                  })}
                />
              )}
              <SiteInfoRow
                label="Prix payé"
                value={`${formatNumber(site.abonnementActif.prixPaye)} XAF`}
              />
            </div>
          )}
        </TabsContent>

        {/* ── Audit ──────────────────────────────────────────────────────── */}
        <TabsContent value="audit">
          <AdminSiteAuditLog logs={site.recentAuditLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper interne
// ---------------------------------------------------------------------------

function SiteInfoRow({
  label,
  value,
  mono,
  icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        {icon}
        <span
          className={`text-sm text-right text-foreground truncate ${mono ? "font-mono text-xs" : "font-medium"}`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
