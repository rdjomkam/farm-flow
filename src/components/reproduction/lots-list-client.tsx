"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Fish, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PhaseLot, StatutLotAlevins, Permission } from "@/types";

// ---------------------------------------------------------------------------
// Data shape types (plain JSON from server)
// ---------------------------------------------------------------------------

export interface LotAlevinsData {
  id: string;
  code: string;
  phase: string;
  statut: string;
  nombreInitial: number;
  nombreActuel: number;
  poidsMoyen: number | null;
  ageJours: number;
  dateDebutPhase: string;
  createdAt: string;
  ponte?: { id: string; code: string } | null;
  bac?: { id: string; nom: string } | null;
  _count?: { sousLots: number };
}

interface LotsListClientProps {
  lots: LotAlevinsData[];
  permissions: Permission[];
}

// ---------------------------------------------------------------------------
// Helper badge utilities
// ---------------------------------------------------------------------------

function phaseBadgeClass(phase: string): string {
  switch (phase) {
    case PhaseLot.INCUBATION:
      return "bg-accent-blue-muted text-accent-blue";
    case PhaseLot.LARVAIRE:
      return "bg-accent-purple-muted text-accent-purple";
    case PhaseLot.NURSERIE:
      return "bg-accent-amber-muted text-accent-amber";
    case PhaseLot.ALEVINAGE:
      return "bg-accent-green-muted text-accent-green";
    case PhaseLot.SORTI:
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function statutBadgeClass(statut: string): string {
  switch (statut) {
    case StatutLotAlevins.EN_INCUBATION:
      return "bg-accent-blue-muted text-accent-blue";
    case StatutLotAlevins.EN_ELEVAGE:
      return "bg-accent-green-muted text-accent-green";
    case StatutLotAlevins.TRANSFERE:
      return "bg-muted text-muted-foreground";
    case StatutLotAlevins.PERDU:
      return "bg-accent-red-muted text-accent-red";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LotsListClient({ lots, permissions }: LotsListClientProps) {
  const t = useTranslations("reproduction.lots");
  const router = useRouter();

  const [tab, setTab] = useState("tous");
  const [search, setSearch] = useState("");

  const canCreate = permissions.includes(Permission.ALEVINS_CREER);

  const phaseLabels: Record<string, string> = {
    [PhaseLot.INCUBATION]: t("phases.INCUBATION"),
    [PhaseLot.LARVAIRE]: t("phases.LARVAIRE"),
    [PhaseLot.NURSERIE]: t("phases.NURSERIE"),
    [PhaseLot.ALEVINAGE]: t("phases.ALEVINAGE"),
    [PhaseLot.SORTI]: t("phases.SORTI"),
  };

  const statutLabels: Record<string, string> = {
    [StatutLotAlevins.EN_INCUBATION]: t("statuts.EN_INCUBATION"),
    [StatutLotAlevins.EN_ELEVAGE]: t("statuts.EN_ELEVAGE"),
    [StatutLotAlevins.TRANSFERE]: t("statuts.TRANSFERE"),
    [StatutLotAlevins.PERDU]: t("statuts.PERDU"),
  };

  const filteredLots = useMemo(() => {
    return lots.filter((lot) => {
      const matchTab =
        tab === "tous"
          ? true
          : tab === "larvaire"
            ? lot.phase === PhaseLot.LARVAIRE
            : tab === "nurserie"
              ? lot.phase === PhaseLot.NURSERIE
              : tab === "alevinage"
                ? lot.phase === PhaseLot.ALEVINAGE
                : tab === "sortis"
                  ? lot.phase === PhaseLot.SORTI
                  : true;

      const q = search.trim().toLowerCase();
      const matchSearch = !q || lot.code.toLowerCase().includes(q);

      return matchTab && matchSearch;
    });
  }, [lots, tab, search]);

  const isEmpty = filteredLots.length === 0;

  const countLabel =
    lots.length === 1
      ? t("count", { count: lots.length })
      : t("countPlural", { count: lots.length });

  return (
    <div className="flex flex-col gap-4">
      {/* Header: count + create button */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{countLabel}</p>

        {canCreate && (
          <Button
            size="sm"
            onClick={() => router.push("/reproduction/lots/nouveau")}
            className="min-h-[44px]"
          >
            <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
            {t("nouveau")}
          </Button>
        )}
      </div>

      {/* Search */}
      <Input
        placeholder={t("search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Tabs by phase */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-max">
            <TabsTrigger value="tous">{t("tabs.tous")}</TabsTrigger>
            <TabsTrigger value="larvaire">{t("tabs.larvaire")}</TabsTrigger>
            <TabsTrigger value="nurserie">{t("tabs.nurserie")}</TabsTrigger>
            <TabsTrigger value="alevinage">{t("tabs.alevinage")}</TabsTrigger>
            <TabsTrigger value="sortis">{t("tabs.sortis")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={tab}>
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Fish className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
              <p className="text-muted-foreground">{t("aucun")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              {filteredLots.map((lot) => {
                const survieRate =
                  lot.nombreInitial > 0
                    ? (lot.nombreActuel / lot.nombreInitial) * 100
                    : 100;
                const isLowSurvival = survieRate < 50;

                return (
                  <Card
                    key={lot.id}
                    className="hover:ring-1 hover:ring-primary/30 transition-all cursor-pointer"
                    onClick={() => router.push(`/reproduction/lots/${lot.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {/* Code + badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold truncate">{lot.code}</p>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${phaseBadgeClass(lot.phase)}`}
                            >
                              {phaseLabels[lot.phase] ?? lot.phase}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statutBadgeClass(lot.statut)}`}
                            >
                              {statutLabels[lot.statut] ?? lot.statut}
                            </span>
                            {isLowSurvival && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-accent-red-muted text-accent-red">
                                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                {t("card.alerteSurvie")}
                              </span>
                            )}
                          </div>

                          {/* Stats row */}
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <span>
                              {lot.nombreActuel}/{lot.nombreInitial}{" "}
                              {t("card.poissons")}
                            </span>
                            <span
                              className={isLowSurvival ? "text-accent-red font-medium" : ""}
                            >
                              {survieRate.toFixed(0)}% {t("card.survie")}
                            </span>
                            {lot.poidsMoyen !== null && (
                              <span>
                                {lot.poidsMoyen} {t("card.grammesUnit")}
                              </span>
                            )}
                            {lot.ageJours > 0 && (
                              <span>
                                {lot.ageJours} {t("card.joursUnit")}
                              </span>
                            )}
                            {lot.bac && (
                              <span>
                                {t("card.bac")}: {lot.bac.nom}
                              </span>
                            )}
                          </div>

                          {/* Ponte link */}
                          {lot.ponte && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("card.ponte")}: {lot.ponte.code}
                            </p>
                          )}
                        </div>

                        {/* Right: sous-lots count */}
                        {(lot._count?.sousLots ?? 0) > 0 && (
                          <div className="text-right text-xs text-muted-foreground shrink-0">
                            <p>
                              {lot._count?.sousLots} {t("card.sousLots")}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
