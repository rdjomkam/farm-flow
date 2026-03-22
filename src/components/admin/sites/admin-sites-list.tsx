"use client";

/**
 * admin-sites-list.tsx
 *
 * Liste des sites côté admin plateforme.
 * Mobile-first (360px) : cartes empilées.
 * Desktop (md+) : table.
 *
 * KPI cards en haut : Total sites, Actifs, Suspendus, Bloqués.
 * Tabs par statut : Tous | Actifs | Suspendus | Bloqués | Archivés.
 * Barre de recherche par nom.
 *
 * ADR-021 section 4.2.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { Building2, Search, Users, Layers } from "lucide-react";
import { SiteStatus } from "@/types";
import type { AdminSiteSummary, AdminSitesListResponse } from "@/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminSiteStatusBadge } from "./admin-site-status-badge";
import { AdminSiteStatusDialog } from "./admin-site-status-dialog";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: number;
  color?: string;
}

function KpiCard({ label, value, color }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Site card (mobile)
// ---------------------------------------------------------------------------

interface SiteCardProps {
  site: AdminSiteSummary;
  onStatusChanged: () => void;
}

function SiteCard({ site, onStatusChanged }: SiteCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{site.name}</p>
          {site.address && (
            <p className="text-xs text-muted-foreground truncate">{site.address}</p>
          )}
        </div>
        <AdminSiteStatusBadge status={site.status} />
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {site.memberCount} membre{site.memberCount !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" />
          {site.enabledModules.length} module{site.enabledModules.length !== 1 ? "s" : ""}
        </span>
        <span>
          Créé le{" "}
          {new Date(site.createdAt).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>

      {site.abonnement && (
        <div className="text-xs text-muted-foreground">
          Plan : <span className="font-medium text-foreground">{site.abonnement.planNom}</span>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Link href={`/admin/sites/${site.id}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full">
            Gérer
          </Button>
        </Link>
        {site.status !== SiteStatus.ARCHIVED && !site.isPlatform && (
          <AdminSiteStatusDialog
            siteId={site.id}
            siteName={site.name}
            currentStatus={site.status}
            trigger={
              <Button variant="ghost" size="sm">
                Actions
              </Button>
            }
            onSuccess={onStatusChanged}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Site table row (desktop)
// ---------------------------------------------------------------------------

function SiteTableRow({
  site,
  onStatusChanged,
}: {
  site: AdminSiteSummary;
  onStatusChanged: () => void;
}) {
  return (
    <tr className="border-b border-border hover:bg-muted/40 transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-foreground">{site.name}</p>
          {site.address && (
            <p className="text-xs text-muted-foreground">{site.address}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <AdminSiteStatusBadge status={site.status} />
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {site.abonnement?.planNom ?? <span className="italic">Aucun plan</span>}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{site.memberCount}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{site.enabledModules.length}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {new Date(site.createdAt).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href={`/admin/sites/${site.id}`}>
            <Button variant="outline" size="sm">
              Gérer
            </Button>
          </Link>
          {site.status !== SiteStatus.ARCHIVED && !site.isPlatform && (
            <AdminSiteStatusDialog
              siteId={site.id}
              siteName={site.name}
              currentStatus={site.status}
              trigger={
                <Button variant="ghost" size="sm">
                  Actions
                </Button>
              }
              onSuccess={onStatusChanged}
            />
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface AdminSitesListProps {
  initialData: AdminSitesListResponse;
}

type TabValue = "all" | "active" | "suspended" | "blocked" | "archived";

const TAB_STATUS: Record<TabValue, SiteStatus | null> = {
  all: null,
  active: SiteStatus.ACTIVE,
  suspended: SiteStatus.SUSPENDED,
  blocked: SiteStatus.BLOCKED,
  archived: SiteStatus.ARCHIVED,
};

export function AdminSitesList({ initialData }: AdminSitesListProps) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Filtrage local (les données ont déjà été filtrées côté serveur pour la pagination,
  // mais on applique une recherche locale pour la réactivité immédiate).
  const filtered = useMemo(() => {
    const statusFilter = TAB_STATUS[activeTab];
    return data.sites.filter((site) => {
      if (statusFilter && site.status !== statusFilter) return false;
      if (search.trim() && !site.name.toLowerCase().includes(search.trim().toLowerCase()))
        return false;
      return true;
    });
  }, [data.sites, activeTab, search]);

  async function refetch() {
    try {
      const res = await fetch("/api/admin/sites?limit=200");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silencieux — l'utilisateur peut rafraîchir la page
    }
    setRefreshKey((k) => k + 1);
  }

  const { stats } = data;

  return (
    <div className="space-y-6" key={refreshKey}>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total" value={stats.totalActive + stats.totalSuspended + stats.totalBlocked + stats.totalArchived} />
        <KpiCard label="Actifs" value={stats.totalActive} color="text-success" />
        <KpiCard label="Suspendus" value={stats.totalSuspended} color="text-accent-amber" />
        <KpiCard label="Bloqués" value={stats.totalBlocked} color="text-danger" />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Rechercher par nom..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-input py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="all">Tous ({data.sites.length})</TabsTrigger>
          <TabsTrigger value="active">Actifs ({stats.totalActive})</TabsTrigger>
          <TabsTrigger value="suspended">Suspendus ({stats.totalSuspended})</TabsTrigger>
          <TabsTrigger value="blocked">Bloqués ({stats.totalBlocked})</TabsTrigger>
          <TabsTrigger value="archived">Archivés ({stats.totalArchived})</TabsTrigger>
        </TabsList>

        {(["all", "active", "suspended", "blocked", "archived"] as TabValue[]).map((tab) => (
          <TabsContent key={tab} value={tab}>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">Aucun site trouvé</p>
              </div>
            ) : (
              <>
                {/* Mobile — cartes empilées */}
                <div className="space-y-3 md:hidden">
                  {filtered.map((site) => (
                    <SiteCard key={site.id} site={site} onStatusChanged={refetch} />
                  ))}
                </div>

                {/* Desktop — table */}
                <div className="hidden md:block rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Nom
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Statut
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Plan
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Membres
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Modules
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Créé le
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card">
                      {filtered.map((site) => (
                        <SiteTableRow
                          key={site.id}
                          site={site}
                          onStatusChanged={refetch}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
