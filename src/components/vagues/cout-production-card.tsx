"use client";

/**
 * CoutProductionCard — Carte de résumé du coût de production d'une vague.
 *
 * Affiche :
 * - Résumé toujours visible : coût total, coût/kg, prix vente/kg, marge/kg, ROI
 * - Détail expandable : répartition par catégorie + revenus/marge
 * - Bouton d'export PDF via ExportButton
 *
 * Story CP-3 — Mobile-first (360px), règles R2 + R6
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { formatNumber } from "@/lib/format";
import type { CoutProductionVague } from "@/lib/queries/finances";
import { CategorieDepense } from "@/types";

interface CoutProductionCardProps {
  data: CoutProductionVague;
  vagueId: string;
}

// ---------------------------------------------------------------------------
// Labels des catégories
// ---------------------------------------------------------------------------

const CATEGORIE_LABELS: Record<string, string> = {
  [CategorieDepense.ALIMENT]: "Alimentation",
  [CategorieDepense.INTRANT]: "Intrants",
  [CategorieDepense.EQUIPEMENT]: "Équipement",
  [CategorieDepense.ELECTRICITE]: "Électricité",
  [CategorieDepense.EAU]: "Eau",
  [CategorieDepense.LOYER]: "Loyer",
  [CategorieDepense.SALAIRE]: "Salaires",
  [CategorieDepense.TRANSPORT]: "Transport",
  [CategorieDepense.VETERINAIRE]: "Vétérinaire",
  [CategorieDepense.REPARATION]: "Réparation",
  [CategorieDepense.INVESTISSEMENT]: "Investissement",
  [CategorieDepense.AUTRE]: "Autre",
  MULTI_VAGUE: "Coûts partagés",
};

function getCategorieLabel(categorie: string): string {
  return CATEGORIE_LABELS[categorie] ?? categorie;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function CoutProductionCard({ data, vagueId }: CoutProductionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const { resume, coutParCategorie } = data;
  const isEmpty = resume.coutTotal === 0;

  const margeColor =
    resume.margeParKg === null
      ? ""
      : resume.margeParKg >= 0
      ? "text-success"
      : "text-destructive";

  const roiColor =
    resume.roi === null
      ? ""
      : resume.roi >= 0
      ? "text-success"
      : "text-destructive";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-3 pb-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Coût de production</h2>
          <div className="flex items-center gap-2">
            <ExportButton
              href={`/api/export/vague/${vagueId}/cout-production`}
              filename={`cout-production-vague-${vagueId}.pdf`}
              label="Exporter PDF"
              variant="outline"
              className="text-xs px-2"
            />
            {!isEmpty && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? "Réduire le détail" : "Voir le détail"}
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-2">
        {isEmpty ? (
          <p className="text-sm text-muted-foreground text-center py-3">
            Aucun coût enregistré pour cette vague.
          </p>
        ) : (
          <>
            {/* Résumé — toujours visible */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              <SummaryItem
                label="Coût total"
                value={`${formatNumber(resume.coutTotal)} FCFA`}
              />
              <SummaryItem
                label="Coût / kg"
                value={
                  resume.coutParKg !== null
                    ? `${formatNumber(Math.round(resume.coutParKg))} FCFA`
                    : "—"
                }
              />
              <SummaryItem
                label="Prix vente / kg"
                value={
                  resume.prixMoyenVenteKg !== null
                    ? `${formatNumber(Math.round(resume.prixMoyenVenteKg))} FCFA`
                    : "—"
                }
              />
              <SummaryItem
                label="Marge / kg"
                value={
                  resume.margeParKg !== null
                    ? `${formatNumber(Math.round(resume.margeParKg))} FCFA`
                    : "—"
                }
                valueClassName={margeColor}
                icon={
                  resume.margeParKg !== null && resume.margeParKg >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : resume.margeParKg !== null ? (
                    <TrendingDown className="h-3.5 w-3.5" />
                  ) : null
                }
              />
              <SummaryItem
                label="ROI"
                value={
                  resume.roi !== null ? `${resume.roi.toFixed(1)} %` : "—"
                }
                valueClassName={roiColor}
              />
            </div>

            {/* Détail expandable */}
            {expanded && coutParCategorie.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-border pt-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Répartition par catégorie
                </h3>

                <div className="space-y-2">
                  {coutParCategorie.map((item) => (
                    <div key={item.categorie} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground">
                          {getCategorieLabel(item.categorie)}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-muted-foreground text-xs">
                            {item.pourcentage.toFixed(1)} %
                          </span>
                          <span className="font-medium tabular-nums">
                            {formatNumber(item.montant)} FCFA
                          </span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${Math.min(item.pourcentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Revenus et marge */}
                <div className="border-t border-border pt-2 mt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Revenus</span>
                    <span className="font-medium tabular-nums">
                      {formatNumber(resume.revenus)} FCFA
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Marge brute</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        resume.marge >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {resume.marge >= 0 ? "+" : ""}
                      {formatNumber(resume.marge)} FCFA
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SummaryItem — cellule individuelle du résumé
// ---------------------------------------------------------------------------

interface SummaryItemProps {
  label: string;
  value: string;
  valueClassName?: string;
  icon?: React.ReactNode;
}

function SummaryItem({ label, value, valueClassName = "", icon }: SummaryItemProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center min-w-0 py-1">
      <div className={`flex items-center gap-1 text-sm font-bold leading-tight ${valueClassName}`}>
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="truncate">{value}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}
