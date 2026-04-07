"use client";

/**
 * admin-modules-list.tsx
 *
 * Liste des modules du registre plateforme DKFarm.
 * Mobile-first (360px) : cartes empilees.
 * Desktop (md+) : tableau.
 *
 * Filtres : tabs Visible/Masque, Site/Platform.
 * Recherche par label.
 *
 * Story E.2 — Sprint E (ADR-021).
 * R5 : DialogTrigger asChild.
 * R6 : couleurs via CSS variables.
 */

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Search, Package, Eye, EyeOff, Globe, Monitor } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AdminModuleFormDialog } from "./admin-module-form-dialog";
import type { AdminModulesListResponse, ModuleDefinitionResponse } from "@/types";

// ---------------------------------------------------------------------------
// Level badge
// ---------------------------------------------------------------------------

function LevelBadge({ level }: { level: "site" | "platform" }) {
  if (level === "platform") {
    return (
      <Badge variant="warning" className="flex items-center gap-1">
        <Globe className="h-3 w-3" />
        Platform
      </Badge>
    );
  }
  return (
    <Badge variant="info" className="flex items-center gap-1">
      <Monitor className="h-3 w-3" />
      Site
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ isActive, t }: { isActive: boolean; t: ReturnType<typeof useTranslations> }) {
  if (isActive) {
    return <Badge variant="terminee">{t("active")}</Badge>;
  }
  return <Badge variant="annulee">{t("inactive")}</Badge>;
}

// ---------------------------------------------------------------------------
// Mobile card
// ---------------------------------------------------------------------------

interface ModuleCardProps {
  module: ModuleDefinitionResponse;
  onUpdated: (updated: ModuleDefinitionResponse) => void;
  t: ReturnType<typeof useTranslations>;
}

function ModuleCard({ module, onUpdated, t }: ModuleCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{module.label}</p>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">{module.key}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <LevelBadge level={module.level} />
          <StatusBadge isActive={module.isActive} t={t} />
        </div>
      </div>

      {/* Description */}
      {module.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">{module.description}</p>
      )}

      {/* Metadata */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {module.category && (
          <span className="rounded-md bg-muted px-2 py-0.5">{module.category}</span>
        )}
        <span className="rounded-md bg-muted px-2 py-0.5">
          Ordre : {module.sortOrder}
        </span>
        {module.isVisible ? (
          <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
            <Eye className="h-3 w-3" /> {t("visible")}
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
            <EyeOff className="h-3 w-3" /> {t("hidden")}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs">
        <span>
          <strong className="text-foreground">{module.siteCount}</strong>{" "}
          <span className="text-muted-foreground">{module.siteCount !== 1 ? t("sitesPlural") : t("sites")}</span>
        </span>
        <span>
          <strong className="text-foreground">{module.planCount}</strong>{" "}
          <span className="text-muted-foreground">{module.planCount !== 1 ? t("plansPlural") : t("plans")}</span>
        </span>
      </div>

      {/* Action */}
      <div className="flex justify-end pt-1">
        <AdminModuleFormDialog module={module} onUpdated={onUpdated} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop table row
// ---------------------------------------------------------------------------

interface ModuleRowProps {
  module: ModuleDefinitionResponse;
  onUpdated: (updated: ModuleDefinitionResponse) => void;
  t: ReturnType<typeof useTranslations>;
}

function ModuleRow({ module, onUpdated, t }: ModuleRowProps) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <td className="py-3 pl-4 pr-2">
        <p className="font-medium text-foreground">{module.label}</p>
        <p className="text-xs font-mono text-muted-foreground">{module.key}</p>
      </td>
      <td className="py-3 px-2">
        <LevelBadge level={module.level} />
      </td>
      <td className="py-3 px-2 text-sm text-muted-foreground">
        {module.category ?? <span className="text-muted-foreground/50">—</span>}
      </td>
      <td className="py-3 px-2 text-center text-sm">{module.sortOrder}</td>
      <td className="py-3 px-2">
        {module.isVisible ? (
          <Eye className="h-4 w-4 text-muted-foreground mx-auto" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground/40 mx-auto" />
        )}
      </td>
      <td className="py-3 px-2">
        <StatusBadge isActive={module.isActive} t={t} />
      </td>
      <td className="py-3 px-2 text-center text-sm">
        <strong>{module.siteCount}</strong>
      </td>
      <td className="py-3 px-2 text-center text-sm">
        <strong>{module.planCount}</strong>
      </td>
      <td className="py-3 pl-2 pr-4">
        <AdminModuleFormDialog module={module} onUpdated={onUpdated} />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Package className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type VisibilityTab = "tous" | "visible" | "cache";
type LevelTab = "tous" | "site" | "platform";

interface AdminModulesListProps {
  initialData: AdminModulesListResponse;
}

export function AdminModulesList({ initialData }: AdminModulesListProps) {
  const t = useTranslations("admin.modules");
  const [modules, setModules] = useState<ModuleDefinitionResponse[]>(
    initialData.modules
  );
  const [search, setSearch] = useState("");
  const [visibilityTab, setVisibilityTab] = useState<VisibilityTab>("tous");
  const [levelTab, setLevelTab] = useState<LevelTab>("tous");

  function handleUpdated(updated: ModuleDefinitionResponse) {
    setModules((prev) =>
      prev.map((m) => (m.key === updated.key ? updated : m))
    );
  }

  const filtered = useMemo(() => {
    let list = modules;

    // Filtre visibility
    if (visibilityTab === "visible") list = list.filter((m) => m.isVisible);
    if (visibilityTab === "cache") list = list.filter((m) => !m.isVisible);

    // Filtre level
    if (levelTab === "site") list = list.filter((m) => m.level === "site");
    if (levelTab === "platform") list = list.filter((m) => m.level === "platform");

    // Filtre recherche
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.label.toLowerCase().includes(q) ||
          m.key.toLowerCase().includes(q) ||
          (m.category ?? "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [modules, visibilityTab, levelTab, search]);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-transparent py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 min-h-[44px]"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        {/* Visibility filter */}
        <div className="flex-1">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("visibility")}</p>
          <Tabs value={visibilityTab} onValueChange={(v) => setVisibilityTab(v as VisibilityTab)}>
            <TabsList>
              <TabsTrigger value="tous">{t("all")}</TabsTrigger>
              <TabsTrigger value="visible">{t("visible")}</TabsTrigger>
              <TabsTrigger value="cache">{t("hidden")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Level filter */}
        <div className="flex-1">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("level")}</p>
          <Tabs value={levelTab} onValueChange={(v) => setLevelTab(v as LevelTab)}>
            <TabsList>
              <TabsTrigger value="tous">{t("all")}</TabsTrigger>
              <TabsTrigger value="site">{t("site")}</TabsTrigger>
              <TabsTrigger value="platform">{t("platform")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} module{filtered.length !== 1 ? "s" : ""} affiche
        {filtered.length !== 1 ? "s" : ""}
      </p>

      {filtered.length === 0 ? (
        <EmptyState label={t("aucunModuleFiltre")} />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((m) => (
              <ModuleCard key={m.key} module={m} onUpdated={handleUpdated} t={t} />
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="py-3 pl-4 pr-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Module
                  </th>
                  <th className="py-3 px-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Niveau
                  </th>
                  <th className="py-3 px-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Categorie
                  </th>
                  <th className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Ordre
                  </th>
                  <th className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Visible
                  </th>
                  <th className="py-3 px-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Statut
                  </th>
                  <th className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Sites
                  </th>
                  <th className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Plans
                  </th>
                  <th className="py-3 pl-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card">
                {filtered.map((m) => (
                  <ModuleRow key={m.key} module={m} onUpdated={handleUpdated} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
