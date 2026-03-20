"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Zap } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useConfigService } from "@/services";
import { TypeDeclencheur } from "@/types";
import type { RegleActiviteWithCount } from "@/types";
import { TYPE_DECLENCHEUR_LABELS } from "@/lib/regles-activites-constants";
import { RegleCard } from "./regle-card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterTab = "all" | "active" | "inactive";

interface Props {
  regles: RegleActiviteWithCount[];
  canManage: boolean;
  canManageGlobal: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All TypeDeclencheur values ordered as they appear in the enum. */
const DECLENCHEUR_ORDER: TypeDeclencheur[] = [
  TypeDeclencheur.RECURRENT,
  TypeDeclencheur.CALENDRIER,
  TypeDeclencheur.SEUIL_POIDS,
  TypeDeclencheur.SEUIL_QUALITE,
  TypeDeclencheur.SEUIL_MORTALITE,
  TypeDeclencheur.STOCK_BAS,
  TypeDeclencheur.FCR_ELEVE,
  TypeDeclencheur.JALON,
];

function filterRegles(
  regles: RegleActiviteWithCount[],
  tab: FilterTab
): RegleActiviteWithCount[] {
  switch (tab) {
    case "active":
      return regles.filter((r) => r.isActive);
    case "inactive":
      return regles.filter((r) => !r.isActive);
    default:
      return regles;
  }
}

function groupByDeclencheur(
  regles: RegleActiviteWithCount[]
): Map<TypeDeclencheur, RegleActiviteWithCount[]> {
  const map = new Map<TypeDeclencheur, RegleActiviteWithCount[]>();

  for (const d of DECLENCHEUR_ORDER) {
    const group = regles.filter((r) => r.typeDeclencheur === d);
    if (group.length > 0) {
      // Already ordered by the query (priorite ASC), maintain that order
      map.set(d, group);
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  tab,
  canManage,
}: {
  tab: FilterTab;
  canManage: boolean;
}) {
  const message =
    tab === "active"
      ? "Aucune regle active."
      : tab === "inactive"
      ? "Aucune regle inactive."
      : "Aucune regle d'activite.";

  return (
    <div className="text-center py-12">
      <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground mb-4">{message}</p>
      {tab === "all" && canManage && (
        <Link href="/settings/regles-activites/nouvelle">
          <Button>Creer une regle</Button>
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReglesListClient({ regles: initialRegles, canManage, canManageGlobal }: Props) {
  const [regles, setRegles] = useState(initialRegles);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const configService = useConfigService();

  // ---- Toggle handler with optimistic update ----
  const handleToggle = async (id: string) => {
    const current = regles.find((r) => r.id === id);
    if (!current) return;

    // Optimistic update
    setRegles((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
    );
    setTogglingId(id);

    const result = await configService.toggleRegle(id);
    if (result.ok && result.data) {
      const data = result.data as { isActive: boolean };
      // Apply server response (source of truth)
      setRegles((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive: data.isActive } : r))
      );
    } else {
      // Revert optimistic update on error
      setRegles((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive: current.isActive } : r))
      );
    }
    setTogglingId(null);
  };

  // ---- Derived data ----
  const filtered = filterRegles(regles, activeTab);
  const grouped = groupByDeclencheur(filtered);

  const activeCount = regles.filter((r) => r.isActive).length;
  const inactiveCount = regles.filter((r) => !r.isActive).length;

  return (
    <div>
      {/* ---- Header actions ---- */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs text-muted-foreground">
          {regles.length} regle{regles.length !== 1 ? "s" : ""} au total
        </p>
        {canManage && (
          <Link href="/settings/regles-activites/nouvelle">
            <Button size="sm" className="shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle regle
            </Button>
          </Link>
        )}
      </div>

      {/* ---- Tabs ---- */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as FilterTab)}
      >
        <TabsList className="w-full mb-4">
          <TabsTrigger value="all" className="flex-1">
            Toutes
            {regles.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs leading-none">
                {regles.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="active" className="flex-1">
            Actives
            {activeCount > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-xs leading-none">
                {activeCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="inactive" className="flex-1">
            Inactives
            {inactiveCount > 0 && (
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs leading-none">
                {inactiveCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ---- Tab content — same template for all three tabs ---- */}
        {(["all", "active", "inactive"] as FilterTab[]).map((tab) => (
          <TabsContent key={tab} value={tab}>
            {filtered.length === 0 ? (
              <EmptyState tab={activeTab} canManage={canManage} />
            ) : (
              <div className="space-y-6">
                {Array.from(grouped.entries()).map(([declencheur, group]) => (
                  <section key={declencheur}>
                    {/* Section header */}
                    <div className="flex items-center gap-2 mb-3">
                      <h2 className="text-sm font-semibold text-foreground">
                        {TYPE_DECLENCHEUR_LABELS[declencheur] ?? declencheur}
                      </h2>
                      <span className="text-xs text-muted-foreground">
                        ({group.length})
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Cards */}
                    <div className="space-y-6">
                      {group.map((regle) => (
                        <RegleCard
                          key={regle.id}
                          regle={regle}
                          onToggle={handleToggle}
                          isToggling={togglingId === regle.id}
                          canManage={canManage}
                          canManageGlobal={canManageGlobal}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
