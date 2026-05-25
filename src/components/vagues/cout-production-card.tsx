"use client";

/**
 * CoutProductionCard — Carte de résumé du coût de production d'une vague.
 *
 * Affiche :
 * - Résumé toujours visible : coût total, coût/kg, prix vente/kg, marge/kg, ROI
 * - Toggle "Inclure pré-grossissement" si la vague a des transferts entrants
 * - Détail expandable :
 *   - Bilan production (biomasse produite/vendue/vivante)
 *   - Répartition par catégorie
 *   - Détail alimentation
 *   - Dépenses directes
 *   - Dépenses partagées multi-vagues
 *   - Dépenses récurrentes
 *   - Rentabilité (coûts vs revenus)
 * - Bouton d'export PDF via ExportButton (avec ?includeParents=true si activé)
 *
 * Story PG.9 — includeParents toggle, mobile-first (360px), règles R2 + R6
 * i18n: uses vagues.coutProduction namespace
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { formatNumber } from "@/lib/format";
import type { CoutProductionVague, CoutProductionDepenseRecurrente } from "@/lib/queries/finances";

interface CoutProductionCardProps {
  data: CoutProductionVague;
  vagueId: string;
  /** Si true, le toggle "Inclure pré-grossissement" est affiché (vague a des transferts entrants) */
  hasParents?: boolean;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function CoutProductionCard({ data, vagueId, hasParents = false }: CoutProductionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [includeParents, setIncludeParents] = useState(false);
  const t = useTranslations("vagues.coutProduction");

  const { resume, coutParCategorie, detailAliments, depensesDirectes, depensesMultiVagues, depensesRecurrentes } = data;
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

  const exportHref = includeParents
    ? `/api/export/vague/${vagueId}/cout-production?includeParents=true`
    : `/api/export/vague/${vagueId}/cout-production`;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-3 pb-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <div className="flex items-center gap-2">
            <ExportButton
              href={exportHref}
              filename={`cout-production-vague-${vagueId}.pdf`}
              label={t("exportPdf")}
              variant="outline"
              className="text-xs px-2"
            />
            {!isEmpty && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? t("collapseLabel") : t("expandLabel")}
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
        {/* Toggle pré-grossissement — affiché uniquement si la vague a des parents */}
        {hasParents && !isEmpty && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
            <button
              type="button"
              role="switch"
              aria-checked={includeParents}
              onClick={() => setIncludeParents((v) => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                includeParents ? "bg-primary" : "bg-input"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                  includeParents ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <label
              className="text-xs text-muted-foreground cursor-pointer select-none"
              onClick={() => setIncludeParents((v) => !v)}
            >
              {t("includeParents")}
            </label>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-3 pt-2">
        {isEmpty ? (
          <p className="text-sm text-muted-foreground text-center py-3">
            {t("empty")}
          </p>
        ) : (
          <>
            {/* Résumé — toujours visible */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              <SummaryItem
                label={t("summary.coutTotal")}
                value={`${formatNumber(resume.coutTotal)} FCFA`}
              />
              <SummaryItem
                label={t("summary.coutParKg")}
                value={
                  resume.coutParKg !== null
                    ? `${formatNumber(Math.round(resume.coutParKg))} FCFA`
                    : "—"
                }
              />
              <SummaryItem
                label={t("summary.prixVenteKg")}
                value={
                  resume.prixMoyenVenteKg !== null
                    ? `${formatNumber(Math.round(resume.prixMoyenVenteKg))} FCFA`
                    : "—"
                }
              />
              <SummaryItem
                label={t("summary.margeParKg")}
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
                label={t("summary.roi")}
                value={
                  resume.roi !== null ? `${resume.roi.toFixed(1)} %` : "—"
                }
                valueClassName={roiColor}
              />
            </div>

            {/* Détail expandable */}
            {expanded && (
              <div className="mt-4 space-y-4 border-t border-border pt-3">

                {/* Bilan Production & Ventes */}
                <ProductionBilan resume={resume} t={t} />

                {/* Répartition par catégorie */}
                {coutParCategorie.length > 0 && (
                  <DetailSection
                    title={t("sections.repartitionCategorie")}
                    description={t("sections.repartitionCategorieDesc")}
                  >
                    <div className="space-y-2">
                      {coutParCategorie.map((item) => (
                        <div key={item.categorie} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground">
                              {t(`categories.${item.categorie}`)}
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
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/70"
                              style={{ width: `${Math.min(item.pourcentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </DetailSection>
                )}

                {/* Détail alimentation */}
                {detailAliments.length > 0 && (
                  <DetailSection
                    title={t("sections.detailAlimentation")}
                    description={t("sections.detailAlimentationDesc")}
                  >
                    <div className="space-y-2">
                      {detailAliments.map((aliment) => (
                        <div
                          key={aliment.produit}
                          className="rounded-md bg-muted/50 p-2 space-y-1"
                        >
                          <p className="text-sm font-medium leading-tight">{aliment.produit}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span>Qté : {formatNumber(aliment.quantite)} kg</span>
                            <span>Prix unitaire : {formatNumber(Math.round(aliment.prixUnitaire))} FCFA/kg</span>
                          </div>
                          <p className="text-sm font-semibold tabular-nums text-right">
                            {formatNumber(aliment.total)} FCFA
                          </p>
                        </div>
                      ))}
                    </div>
                  </DetailSection>
                )}

                {/* Dépenses directes */}
                {depensesDirectes.length > 0 && (
                  <DetailSection
                    title={t("sections.depensesDirectes")}
                    description={t("sections.depensesDirectesDesc")}
                  >
                    <div className="space-y-2">
                      {depensesDirectes.map((dep, i) => (
                        <div key={i} className="rounded-md bg-muted/50 p-2 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-tight truncate">
                                {dep.description}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t(`categories.${dep.categorie}`)} ·{" "}
                                {dep.date
                                  ? new Date(dep.date).toLocaleDateString("fr-FR", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })
                                  : "—"}
                              </p>
                            </div>
                            <span className="text-sm font-semibold tabular-nums shrink-0">
                              {formatNumber(dep.montant)} FCFA
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </DetailSection>
                )}

                {/* Dépenses partagées multi-vagues */}
                {depensesMultiVagues.length > 0 && (
                  <DetailSection
                    title={t("sections.depensesPartagees")}
                    description={t("sections.depensesPartageesDesc")}
                  >
                    <div className="space-y-2">
                      {depensesMultiVagues.map((dep, i) => (
                        <div key={i} className="rounded-md bg-muted/50 p-2 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-tight min-w-0 truncate">
                              {dep.description}
                            </p>
                            <span className="text-sm font-semibold tabular-nums shrink-0">
                              {formatNumber(dep.montantImpute)} FCFA
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span>Total : {formatNumber(dep.montantTotal)} FCFA</span>
                            <span>Ratio : {(dep.ratio * 100).toFixed(1)} %</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </DetailSection>
                )}

                {/* Dépenses récurrentes */}
                {depensesRecurrentes.length > 0 && (
                  <DetailSection
                    title={t("sections.depensesRecurrentes")}
                    description={t("sections.depensesRecurrentesDesc")}
                  >
                    <div className="space-y-2">
                      {depensesRecurrentes.map((dep, i) => (
                        <RecurringExpenseCard key={i} dep={dep} />
                      ))}
                    </div>
                  </DetailSection>
                )}

                {/* Rentabilité */}
                <DetailSection
                  title={t("sections.rentabilite")}
                  description={t("sections.rentabiliteDesc")}
                >
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("rentabilite.coutTotalProduction")}</span>
                      <span className="font-medium tabular-nums text-destructive">
                        -{formatNumber(resume.coutTotal)} FCFA
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("rentabilite.revenusVentes")}</span>
                      <span className="font-medium tabular-nums text-success">
                        +{formatNumber(resume.revenus)} FCFA
                      </span>
                    </div>
                    <div className="border-t border-border pt-1.5 flex justify-between text-sm">
                      <span className="font-medium">{t("rentabilite.margeBrute")}</span>
                      <span
                        className={`font-bold tabular-nums ${
                          resume.marge >= 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        {resume.marge >= 0 ? "+" : ""}
                        {formatNumber(resume.marge)} FCFA
                      </span>
                    </div>
                    {resume.roi !== null && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{t("rentabilite.retourInvestissement")}</span>
                        <span className={`font-medium ${resume.roi >= 0 ? "text-success" : "text-destructive"}`}>
                          {resume.roi >= 0 ? "+" : ""}{resume.roi.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </DetailSection>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ProductionBilan — bilan production vs ventes
// ---------------------------------------------------------------------------

function ProductionBilan({ resume, t }: { resume: CoutProductionVague["resume"]; t: (key: string) => string }) {
  return (
    <DetailSection
      title={t("sections.bilanProduction")}
      description={t("sections.bilanProductionDesc")}
    >
      <div className="rounded-md bg-muted/30 border border-border/50 px-3 py-2.5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {resume.biomasseProduite !== null && (
            <BilanRow label={t("bilan.biomasseProduite")} value={`${formatNumber(Math.round(resume.biomasseProduite * 10) / 10)} kg`} bold />
          )}
          {resume.poidsTotalVendu > 0 && (
            <BilanRow label={t("bilan.biomasseVendue")} value={`${formatNumber(Math.round(resume.poidsTotalVendu * 10) / 10)} kg`} />
          )}
          {resume.biomasseKg !== null && resume.biomasseKg > 0 && (
            <BilanRow label={t("bilan.biomasseVivante")} value={`${formatNumber(Math.round(resume.biomasseKg * 10) / 10)} kg`} />
          )}
          {resume.nombrePoissonsVendus > 0 && (
            <BilanRow label={t("bilan.poissonsVendus")} value={`${formatNumber(resume.nombrePoissonsVendus)}`} />
          )}
        </div>
      </div>
    </DetailSection>
  );
}

function BilanRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm tabular-nums text-right ${bold ? "font-semibold" : "font-medium"}`}>{value}</span>
    </>
  );
}

// ---------------------------------------------------------------------------
// RecurringExpenseCard — carte dépense récurrente avec détail ratio expandable
// ---------------------------------------------------------------------------

function RecurringExpenseCard({ dep }: { dep: CoutProductionDepenseRecurrente }) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className="rounded-md bg-muted/50 p-2 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight min-w-0 truncate">
          {dep.description}
        </p>
        <span className="text-sm font-semibold tabular-nums shrink-0">
          {formatNumber(dep.montantImpute)} FCFA
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        <span>Payé : {formatNumber(dep.montantPayeTotal)} FCFA</span>
        <span>{dep.moisCouverts} mois</span>
        <span>Ratio moy. : {(dep.ratioMoyen * 100).toFixed(1)} %</span>
      </div>
      {dep.ratioDetail.length > 0 && (
        <button
          type="button"
          className="text-xs underline text-muted-foreground hover:text-foreground"
          onClick={() => setShowDetail((v) => !v)}
        >
          {showDetail ? "Masquer le détail" : "Voir le détail du calcul"}
        </button>
      )}
      {showDetail && dep.ratioDetail.length > 0 && (
        <div className="mt-1 space-y-2 border-t border-border pt-1.5">
          {dep.ratioDetail.map((rd) => (
            <div key={rd.mois} className="space-y-0.5">
              <p className="text-xs font-medium">{rd.mois}</p>
              <div className="space-y-0.5 pl-2">
                {rd.vagues.map((v) => (
                  <div key={v.code} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{v.code}</span>
                    <span className="tabular-nums">
                      {v.jours}j × {formatNumber(v.nombreInitial)} = {formatNumber(v.poids)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs font-medium pl-2 border-t border-border/50 pt-0.5">
                <span>Cette vague</span>
                <span className="tabular-nums">
                  {formatNumber(rd.poidsCible)} / {formatNumber(rd.totalPoids)} = {(rd.ratio * 100).toFixed(1)} %
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailSection — section avec titre + description dans le détail expandable
// ---------------------------------------------------------------------------

interface DetailSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function DetailSection({ title, description, children }: DetailSectionProps) {
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground/70 mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
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
