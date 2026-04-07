"use client";

/**
 * src/components/abonnements/downgrade-resource-selector.tsx
 *
 * Composant de sélection des ressources à conserver lors d'un downgrade de plan.
 *
 * Story 50.4 — Sprint 50
 * R5 : DialogTrigger asChild
 * R6 : CSS variables du thème
 * Mobile-first (360px)
 *
 * Affiche les bacs et vagues du site avec cases à cocher.
 * Valide que le nombre sélectionné <= limite du nouveau plan.
 */
import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, CheckSquare, Square, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TypePlan } from "@/types";
import { PLAN_LIMITES } from "@/lib/abonnements-constants";
import type { DowngradeRessourcesAGarder } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BacInfo {
  id: string;
  nom: string;
  isBlocked: boolean;
}

export interface VagueInfo {
  id: string;
  nom: string;
  statut: string;
  isBlocked: boolean;
}

export interface DowngradeResourceSelectorProps {
  /** Nouveau plan vers lequel downgrader */
  nouveauPlanTypePlan: TypePlan;
  /** Bacs du site (non-bloqués) */
  bacs: BacInfo[];
  /** Vagues du site (non-terminées) */
  vagues: VagueInfo[];
  /** siteId du site courant — R8 */
  siteId: string;
  /** Callback appelé avec la sélection finale validée */
  onSelectionChange: (selection: DowngradeRessourcesAGarder) => void;
  /** Valeur initiale de la sélection */
  initialSelection?: DowngradeRessourcesAGarder;
}

// ---------------------------------------------------------------------------
// DowngradeResourceSelector
// ---------------------------------------------------------------------------

export function DowngradeResourceSelector({
  nouveauPlanTypePlan,
  bacs,
  vagues,
  siteId,
  onSelectionChange,
  initialSelection,
}: DowngradeResourceSelectorProps) {
  const t = useTranslations("abonnements");
  // R2/ERR-031 : accès PLAN_LIMITES via TypePlan cast
  const limites = PLAN_LIMITES[nouveauPlanTypePlan];

  const [bacsSelectionnes, setBacsSelectionnes] = useState<Set<string>>(
    () => new Set(initialSelection?.bacs?.[siteId] ?? [])
  );
  const [vaguesSelectionnees, setVaguesSelectionnees] = useState<Set<string>>(
    () => new Set(initialSelection?.vagues?.[siteId] ?? [])
  );

  const [bacsSection, setBacsSection] = useState(true);
  const [vaguesSection, setVaguesSection] = useState(true);

  const limitesBacs = limites.limitesBacs;
  const limitesVagues = limites.limitesVagues;

  const nbBacsSelectionnes = bacsSelectionnes.size;
  const nbVaguesSelectionnees = vaguesSelectionnees.size;

  const bacsValide = nbBacsSelectionnes <= limitesBacs;
  const vaguesValide = nbVaguesSelectionnees <= limitesVagues;
  const selectionValide = bacsValide && vaguesValide;

  const toggleBac = useCallback(
    (id: string) => {
      setBacsSelectionnes((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          if (next.size >= limitesBacs) return prev; // Limite atteinte — pas d'ajout
          next.add(id);
        }
        return next;
      });
    },
    [limitesBacs]
  );

  const toggleVague = useCallback(
    (id: string) => {
      setVaguesSelectionnees((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          if (next.size >= limitesVagues) return prev; // Limite atteinte — pas d'ajout
          next.add(id);
        }
        return next;
      });
    },
    [limitesVagues]
  );

  // Notifier le parent à chaque changement
  const buildSelection = useCallback((): DowngradeRessourcesAGarder => ({
    sites: [siteId],
    bacs: { [siteId]: Array.from(bacsSelectionnes) },
    vagues: { [siteId]: Array.from(vaguesSelectionnees) },
  }), [siteId, bacsSelectionnes, vaguesSelectionnees]);

  const handleConfirmer = () => {
    if (!selectionValide) return;
    onSelectionChange(buildSelection());
  };

  return (
    <div className="space-y-4">
      {/* En-tête de validation */}
      {!selectionValide && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            {!bacsValide && (
              <p>
                {t("downgradeSelector.tooManyTanks", { selected: nbBacsSelectionnes, limit: limitesBacs })}
              </p>
            )}
            {!vaguesValide && (
              <p>
                {t("downgradeSelector.tooManyWaves", { selected: nbVaguesSelectionnees, limit: limitesVagues })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Section Bacs */}
      {bacs.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <button
            type="button"
            onClick={() => setBacsSection((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
          >
            <span>
              {t("downgradeSelector.tanksSection", {
                selected: nbBacsSelectionnes,
                limit: limitesBacs,
                plural: nbBacsSelectionnes !== 1 ? "s" : "",
              })}
            </span>
            {bacsSection ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {bacsSection && (
            <div className="border-t border-border divide-y divide-border">
              {bacs.map((bac) => {
                const selectionne = bacsSelectionnes.has(bac.id);
                const desactive = !selectionne && nbBacsSelectionnes >= limitesBacs;
                return (
                  <button
                    key={bac.id}
                    type="button"
                    onClick={() => toggleBac(bac.id)}
                    disabled={desactive}
                    className={[
                      "flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors",
                      selectionne
                        ? "bg-primary/5 text-foreground"
                        : "text-foreground hover:bg-muted/50",
                      desactive && "opacity-40 cursor-not-allowed",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {selectionne ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate">{bac.nom}</span>
                    {selectionne && (
                      <span className="ml-auto text-xs font-medium text-primary">
                        {t("downgradeSelector.toKeep")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section Vagues */}
      {vagues.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <button
            type="button"
            onClick={() => setVaguesSection((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
          >
            <span>
              {t("downgradeSelector.wavesSection", {
                selected: nbVaguesSelectionnees,
                limit: limitesVagues,
                plural: nbVaguesSelectionnees !== 1 ? "es" : "e",
              })}
            </span>
            {vaguesSection ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {vaguesSection && (
            <div className="border-t border-border divide-y divide-border">
              {vagues.map((vague) => {
                const selectionnee = vaguesSelectionnees.has(vague.id);
                const desactivee = !selectionnee && nbVaguesSelectionnees >= limitesVagues;
                return (
                  <button
                    key={vague.id}
                    type="button"
                    onClick={() => toggleVague(vague.id)}
                    disabled={desactivee}
                    className={[
                      "flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors",
                      selectionnee
                        ? "bg-primary/5 text-foreground"
                        : "text-foreground hover:bg-muted/50",
                      desactivee && "opacity-40 cursor-not-allowed",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {selectionnee ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate">{vague.nom}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {vague.statut}
                    </span>
                    {selectionnee && (
                      <span className="text-xs font-medium text-primary">
                        {t("downgradeSelector.toKeep")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Résumé si aucune ressource */}
      {bacs.length === 0 && vagues.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          {t("downgradeSelector.noResourcesToKeep")}
        </p>
      )}

      {/* Bouton de confirmation */}
      <Button
        type="button"
        onClick={handleConfirmer}
        disabled={!selectionValide}
        className="w-full min-h-[44px]"
      >
        {t("downgradeSelector.confirmSelection", {
          tanks: nbBacsSelectionnes,
          tankPlural: nbBacsSelectionnes !== 1 ? "s" : "",
          waves: nbVaguesSelectionnees,
          wavePlural: nbVaguesSelectionnees !== 1 ? "s" : "",
        })}
      </Button>
    </div>
  );
}
