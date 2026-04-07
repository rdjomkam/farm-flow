"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Fish, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GeniteurForm, type GeniteurMode } from "./geniteur-form";
import { SexeReproducteur, StatutReproducteur, Permission } from "@/types";

// ---------------------------------------------------------------------------
// Data shape types (plain JSON from server)
// ---------------------------------------------------------------------------

export interface LotGeniteurData {
  id: string;
  code: string;
  nom: string;
  sexe: string;
  statut: string;
  nombrePoissons: number;
  poidsMoyenG: number | null;
  nombreMalesDisponibles: number | null;
  seuilAlerteMales: number | null;
  bac?: { id: string; nom: string; volume: number } | null;
  _count?: { pontesAsFemelle: number; pontesAsMale: number };
}

export interface ReproducteurIndividuelData {
  id: string;
  code: string;
  sexe: string;
  statut: string;
  poids: number;
  age: number | null;
  origine: string | null;
  bac?: { id: string; nom: string; volume: number } | null;
  _count?: { pontesAsFemelle: number; pontesAsMale: number };
}

interface BacOption {
  id: string;
  nom: string;
}

interface GeniteursListClientProps {
  lotGeniteurs: LotGeniteurData[];
  reproducteursIndividuels: ReproducteurIndividuelData[];
  permissions: Permission[];
  bacs?: BacOption[];
}

// ---------------------------------------------------------------------------
// Helper badge utilities
// ---------------------------------------------------------------------------

function sexeBadgeClass(sexe: string): string {
  if (sexe === SexeReproducteur.FEMELLE)
    return "bg-accent-purple-muted text-accent-purple";
  return "bg-accent-blue-muted text-accent-blue";
}

function statutBadgeClass(statut: string): string {
  if (statut === StatutReproducteur.ACTIF)
    return "bg-accent-green-muted text-accent-green";
  if (
    statut === StatutReproducteur.EN_REPOS ||
    statut === StatutReproducteur.REFORME
  )
    return "bg-accent-blue-muted text-accent-blue";
  return "bg-accent-red-muted text-accent-red";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GeniteursListClient({
  lotGeniteurs,
  reproducteursIndividuels,
  permissions,
  bacs = [],
}: GeniteursListClientProps) {
  const t = useTranslations("reproduction.geniteurs");
  const router = useRouter();

  const [tab, setTab] = useState("tous");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<GeniteurMode>("GROUPE");
  const [formOpen, setFormOpen] = useState(false);

  const canCreate = permissions.includes(Permission.ALEVINS_CREER);

  const sexeLabels: Record<string, string> = {
    [SexeReproducteur.MALE]: t("sexe.MALE"),
    [SexeReproducteur.FEMELLE]: t("sexe.FEMELLE"),
  };

  const statutLabels: Record<string, string> = {
    [StatutReproducteur.ACTIF]: t("statuts.ACTIF"),
    [StatutReproducteur.EN_REPOS]: t("statuts.EN_REPOS"),
    [StatutReproducteur.REFORME]: t("statuts.REFORME"),
    [StatutReproducteur.SACRIFIE]: t("statuts.SACRIFIE"),
    [StatutReproducteur.MORT]: t("statuts.MORT"),
  };

  // --- Filtered lots (GROUPE mode) ---
  const filteredLots = useMemo(() => {
    return lotGeniteurs.filter((lot) => {
      const matchTab =
        tab === "tous"
          ? true
          : tab === "males"
            ? lot.sexe === SexeReproducteur.MALE
            : tab === "femelles"
              ? lot.sexe === SexeReproducteur.FEMELLE
              : true;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        lot.code.toLowerCase().includes(q) ||
        lot.nom.toLowerCase().includes(q);
      return matchTab && matchSearch;
    });
  }, [lotGeniteurs, tab, search]);

  // --- Filtered reproducteurs (INDIVIDUEL mode) ---
  const filteredReproducteurs = useMemo(() => {
    return reproducteursIndividuels.filter((r) => {
      const matchTab =
        tab === "tous"
          ? true
          : tab === "males"
            ? r.sexe === SexeReproducteur.MALE
            : tab === "femelles"
              ? r.sexe === SexeReproducteur.FEMELLE
              : true;
      const q = search.trim().toLowerCase();
      const matchSearch = !q || r.code.toLowerCase().includes(q);
      return matchTab && matchSearch;
    });
  }, [reproducteursIndividuels, tab, search]);

  const handleFormSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  const isEmpty =
    mode === "GROUPE"
      ? filteredLots.length === 0
      : filteredReproducteurs.length === 0;

  const totalItems =
    mode === "GROUPE"
      ? lotGeniteurs.length
      : reproducteursIndividuels.length;

  const countLabel =
    mode === "GROUPE"
      ? totalItems === 1
        ? t("count", { count: totalItems })
        : t("countPlural", { count: totalItems })
      : totalItems === 1
        ? t("countIndividuel", { count: totalItems })
        : t("countIndividuelPlural", { count: totalItems });

  return (
    <div className="flex flex-col gap-4">
      {/* Header: count + mode toggle + create button */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{countLabel}</p>

        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex rounded-md border border-border overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setMode("GROUPE")}
              className={`px-3 py-1.5 min-h-[36px] transition-colors ${
                mode === "GROUPE"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {t("mode.GROUPE")}
            </button>
            <button
              type="button"
              onClick={() => setMode("INDIVIDUEL")}
              className={`px-3 py-1.5 min-h-[36px] transition-colors ${
                mode === "INDIVIDUEL"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {t("mode.INDIVIDUEL")}
            </button>
          </div>

          {/* Create button — uses DialogTrigger pattern (R5) */}
          {canCreate && (
            <>
              <Button
                size="sm"
                onClick={() => setFormOpen(true)}
                className="min-h-[44px]"
              >
                <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                {t("nouveau")}
              </Button>
              <GeniteurForm
                open={formOpen}
                onOpenChange={setFormOpen}
                mode={mode}
                bacs={bacs}
                onSuccess={handleFormSuccess}
              />
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder={t("search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Tabs: Tous | Femelles | Mâles */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-max">
            <TabsTrigger value="tous">{t("tabs.tous")}</TabsTrigger>
            <TabsTrigger value="femelles">{t("tabs.femelles")}</TabsTrigger>
            <TabsTrigger value="males">{t("tabs.males")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={tab}>
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Fish className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
              <p className="text-muted-foreground">
                {mode === "GROUPE" ? t("aucun") : t("aucunIndividuel")}
              </p>
            </div>
          ) : mode === "GROUPE" ? (
            <div className="flex flex-col gap-2 mt-2">
              {filteredLots.map((lot) => {
                const isLowMales =
                  lot.sexe === SexeReproducteur.MALE &&
                  lot.nombreMalesDisponibles !== null &&
                  lot.seuilAlerteMales !== null &&
                  lot.nombreMalesDisponibles <= lot.seuilAlerteMales;

                const pontes =
                  (lot._count?.pontesAsFemelle ?? 0) +
                  (lot._count?.pontesAsMale ?? 0);

                return (
                  <Card
                    key={lot.id}
                    className="hover:ring-1 hover:ring-primary/30 transition-all"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {/* Code + badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold truncate">{lot.code}</p>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sexeBadgeClass(lot.sexe)}`}
                            >
                              {sexeLabels[lot.sexe] ?? lot.sexe}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statutBadgeClass(lot.statut)}`}
                            >
                              {statutLabels[lot.statut] ?? lot.statut}
                            </span>
                            {isLowMales && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-accent-amber-muted text-accent-amber">
                                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                {t("card.alerteMales")}
                              </span>
                            )}
                          </div>

                          {/* Nom */}
                          <p className="text-sm text-muted-foreground mt-0.5 truncate">
                            {lot.nom}
                          </p>

                          {/* Stats row */}
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <span>
                              {lot.nombrePoissons} {t("card.poissons")}
                            </span>
                            {lot.poidsMoyenG !== null && (
                              <span>
                                {lot.poidsMoyenG} {t("card.grammesUnit")}{" "}
                                {t("card.poidsMoyen")}
                              </span>
                            )}
                            {lot.sexe === SexeReproducteur.MALE &&
                              lot.nombreMalesDisponibles !== null && (
                                <span
                                  className={
                                    isLowMales ? "text-accent-amber font-medium" : ""
                                  }
                                >
                                  {lot.nombreMalesDisponibles}{" "}
                                  {t("card.malesDisponibles")}
                                </span>
                              )}
                            {lot.bac && (
                              <span>
                                {t("card.bac")}: {lot.bac.nom}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right column */}
                        <div className="text-right text-xs text-muted-foreground shrink-0">
                          <p>
                            {pontes} {t("card.pontes")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              {filteredReproducteurs.map((r) => {
                const pontes =
                  (r._count?.pontesAsFemelle ?? 0) +
                  (r._count?.pontesAsMale ?? 0);

                return (
                  <Card
                    key={r.id}
                    className="hover:ring-1 hover:ring-primary/30 transition-all"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {/* Code + badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">{r.code}</p>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sexeBadgeClass(r.sexe)}`}
                            >
                              {sexeLabels[r.sexe] ?? r.sexe}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statutBadgeClass(r.statut)}`}
                            >
                              {statutLabels[r.statut] ?? r.statut}
                            </span>
                          </div>

                          {/* Stats */}
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <span>
                              {r.poids} {t("card.grammesUnit")}
                            </span>
                            {r.age !== null && (
                              <span>
                                {r.age} {t("card.moisUnit")}
                              </span>
                            )}
                            {r.origine && (
                              <span className="truncate">{r.origine}</span>
                            )}
                            {r.bac && (
                              <span>
                                {t("card.bac")}: {r.bac.nom}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right text-xs text-muted-foreground shrink-0">
                          <p>
                            {pontes} {t("card.pontes")}
                          </p>
                        </div>
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
