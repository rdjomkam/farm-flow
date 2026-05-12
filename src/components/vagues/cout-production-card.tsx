"use client";

/**
 * CoutProductionCard — Carte de résumé du coût de production d'une vague.
 *
 * Affiche :
 * - Résumé toujours visible : coût total, coût/kg, prix vente/kg, marge/kg, ROI
 * - Détail expandable :
 *   - Biomasse estimée
 *   - Répartition par catégorie
 *   - Détail alimentation
 *   - Dépenses directes
 *   - Dépenses partagées multi-vagues
 *   - Dépenses récurrentes
 *   - Revenus et marge
 * - Bouton d'export PDF via ExportButton
 *
 * Story CP-3 — Mobile-first (360px), règles R2 + R6
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { formatNumber } from "@/lib/format";
import type { CoutProductionVague, CoutProductionDepenseRecurrente } from "@/lib/queries/finances";
import { CategorieDepense } from "@/types";

interface CoutProductionCardProps {
  data: CoutProductionVague;
  vagueId: string;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function CoutProductionCard({ data, vagueId }: CoutProductionCardProps) {
  const [expanded, setExpanded] = useState(false);
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

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-3 pb-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <div className="flex items-center gap-2">
            <ExportButton
              href={`/api/export/vague/${vagueId}/cout-production`}
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
                aria-label={expanded ? t("collapseAriaLabel") : t("expandAriaLabel")}
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
                label={t("summary.prixVenteParKg")}
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

                {/* Biomasse estimée */}
                {resume.biomasseKg !== null && (
                  <BiomasseBanner biomasseKg={resume.biomasseKg} />
                )}

                {/* Répartition par catégorie */}
                {coutParCategorie.length > 0 && (
                  <DetailSection title={t("sections.repartitionCategorie")}>
                    <div className="space-y-2">
                      {coutParCategorie.map((item) => (
                        <div key={item.categorie} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground">
                              {t(`categories.${item.categorie}` as Parameters<typeof t>[0])}
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
                  <DetailSection title={t("sections.detailAlimentation")}>
                    <div className="space-y-2">
                      {detailAliments.map((aliment) => (
                        <div
                          key={aliment.produit}
                          className="rounded-md bg-muted/50 p-2 space-y-1"
                        >
                          <p className="text-sm font-medium leading-tight">{aliment.produit}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span>{t("labels.qte", { value: formatNumber(aliment.quantite) })}</span>
                            <span>{t("labels.prixUnitaire", { value: formatNumber(Math.round(aliment.prixUnitaire)) })}</span>
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
                  <DetailSection title={t("sections.depensesDirectes")}>
                    <div className="space-y-2">
                      {depensesDirectes.map((dep, i) => (
                        <div key={i} className="rounded-md bg-muted/50 p-2 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-tight truncate">
                                {dep.description}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t(`categories.${dep.categorie}` as Parameters<typeof t>[0])} ·{" "}
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
                  <DetailSection title={t("sections.depensesPartagees")}>
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
                            <span>{t("labels.total", { value: formatNumber(dep.montantTotal) })}</span>
                            <span>{t("labels.ratio", { value: (dep.ratio * 100).toFixed(1) })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </DetailSection>
                )}

                {/* Dépenses récurrentes */}
                {depensesRecurrentes.length > 0 && (
                  <DetailSection title={t("sections.depensesRecurrentes")}>
                    <p className="text-xs text-muted-foreground -mt-1 mb-2">
                      {t("sections.ratioExplanation")}
                    </p>
                    <div className="space-y-2">
                      {depensesRecurrentes.map((dep, i) => (
                        <RecurringExpenseCard key={i} dep={dep} />
                      ))}
                    </div>
                  </DetailSection>
                )}

                {/* Revenus et marge */}
                <div className="border-t border-border pt-2 mt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("labels.revenus")}</span>
                    <span className="font-medium tabular-nums">
                      {formatNumber(resume.revenus)} FCFA
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("labels.margeBrute")}</span>
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
// BiomasseBanner — affiche la biomasse estimée en évidence
// ---------------------------------------------------------------------------

function BiomasseBanner({ biomasseKg }: { biomasseKg: number }) {
  const t = useTranslations("vagues.coutProduction");
  return (
    <div className="rounded-md bg-primary/10 border border-primary/20 px-3 py-2 flex items-center justify-between gap-2">
      <div>
        <p className="text-xs text-muted-foreground">{t("biomasse.title")}</p>
        <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
          {formatNumber(Math.round(biomasseKg * 10) / 10)} kg
        </p>
      </div>
      <p className="text-xs text-muted-foreground text-right leading-tight max-w-[160px]">
        {t("biomasse.baseCout")}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecurringExpenseCard — carte dépense récurrente avec détail ratio expandable
// ---------------------------------------------------------------------------

function RecurringExpenseCard({ dep }: { dep: CoutProductionDepenseRecurrente }) {
  const [showDetail, setShowDetail] = useState(false);
  const t = useTranslations("vagues.coutProduction");

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
        <span>{t("labels.mensuel", { value: formatNumber(Math.round(dep.coutMensuel)) })}</span>
        <span>{t("labels.mois", { count: dep.moisImputes })}</span>
        <span>{t("labels.ratioMoyen", { value: (dep.ratioMoyen * 100).toFixed(1) })}</span>
      </div>
      {dep.ratioDetail.length > 0 && (
        <button
          type="button"
          className="text-xs underline text-muted-foreground hover:text-foreground"
          onClick={() => setShowDetail((v) => !v)}
        >
          {showDetail ? t("detail.hide") : t("detail.show")}
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
                <span>{t("labels.cetteVague")}</span>
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
// DetailSection — section avec titre dans le détail expandable
// ---------------------------------------------------------------------------

interface DetailSectionProps {
  title: string;
  children: React.ReactNode;
}

function DetailSection({ title, children }: DetailSectionProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
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
