"use client";

/**
 * src/components/previsions/aliments-tab.tsx
 *
 * Onglet Granulometries — referentiel a un seul niveau, calibre = article
 * (ADR-053 §12.3/§12.6, amendement post-PR2-quater : fusion
 * `AlimentArticlePrevision` -> `AlimentPrevision`). Cartes empilees
 * mobile-first (pas de tableau). Chaque calibre porte directement son
 * libelle, poids de sac et prix de sac — plus de sous-liste d'articles ni de
 * part d'approvisionnement (toujours 100% implicite, jamais affichee).
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Permission } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { ValeurCalculee } from "@/components/previsions/valeur-calculee";
import { AlimentFormDialog } from "@/components/previsions/aliment-form-dialog";
import { AlimentEditDialog } from "@/components/previsions/aliment-edit-dialog";
import { RepartitionMoisDialog } from "@/components/previsions/repartition-mois-dialog";
import { formatMontantPrevision, formatPourcentagePrevision } from "@/lib/previsions/format-previsions";
import type { AlimentPrevisionDTO } from "@/components/previsions/api-types";

interface AlimentsTabProps {
  scenarioId: string;
  dureeCycleMois: number;
  initialAliments: AlimentPrevisionDTO[];
  permissions: Permission[];
  /** Cf. `parametres-tab.tsx` — declenche le refresh de la projection. */
  onDataChanged?: () => void;
}

export function AlimentsTab({
  scenarioId,
  dureeCycleMois,
  initialAliments,
  permissions,
  onDataChanged,
}: AlimentsTabProps) {
  const t = useTranslations("previsions");
  const tStock = useTranslations("stock");
  const { del } = usePrevisionsApi();
  const [aliments, setAliments] = useState(initialAliments);
  const [editingAliment, setEditingAliment] = useState<AlimentPrevisionDTO | null>(null);
  const peutParametrer = permissions.includes(Permission.PREVISIONS_PARAMETRER);

  async function handleDelete(id: string) {
    const result = await del(`/api/previsions/aliments/${id}`);
    if (result.ok) {
      setAliments((prev) => prev.filter((a) => a.id !== id));
      onDataChanged?.();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {peutParametrer && (
        <div className="flex justify-end">
          <AlimentFormDialog
            scenarioId={scenarioId}
            ordreSuivant={aliments.length}
            taillesGranuleUtilisees={aliments.map((a) => a.tailleGranule)}
            onCreated={(a) => {
              setAliments((prev) => [...prev, a]);
              onDataChanged?.();
            }}
          />
        </div>
      )}

      {aliments.length === 0 ? (
        <EmptyState
          icon={<Percent className="h-8 w-8" />}
          title={t("aliments.emptyTitle")}
          description={t("aliments.emptyDescription")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {aliments.map((a) => {
            const sommeRepartition = a.repartitions.reduce((sum, r) => sum + Number(r.pourcentage), 0);
            const calibreLabel = tStock(`produits.taillesGranule.${a.tailleGranule}`);
            return (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => peutParametrer && setEditingAliment(a)}
                  disabled={!peutParametrer}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{calibreLabel}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {t("aliments.articleSummary", {
                          libelle: a.libelle,
                          poids: Number(a.poidsSacKg),
                          prix: formatMontantPrevision(a.prixSacFCFA),
                        })}
                      </p>
                    </div>
                    {peutParametrer && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); handleDelete(a.id); } }}
                        className="flex h-11 w-11 shrink-0 items-center justify-center text-danger"
                        aria-label={t("aliments.deleteAria", { libelle: calibreLabel })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {a.sacsParTonneStandard !== null ? (
                      <span className="rounded-md bg-muted px-2 py-1 text-sm text-muted-foreground">
                        {t("aliments.needLabel", { value: Number(a.sacsParTonneStandard) })}
                      </span>
                    ) : (
                      <span className="rounded-md bg-accent-amber-muted px-2 py-1 text-sm text-accent-amber">
                        {t("aliments.needMissing")}
                      </span>
                    )}
                  </div>
                </button>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {t("aliments.monthlyRepartitionLabel")}
                    <ValeurCalculee
                      value={
                        <span
                          className={
                            sommeRepartition === 100
                              ? "text-success"
                              : a.repartitions.length === 0
                              ? "text-muted-foreground"
                              : "text-danger"
                          }
                        >
                          {formatPourcentagePrevision(sommeRepartition)}
                        </span>
                      }
                      formule={t("aliments.monthlyRepartitionFormule")}
                      explication={a.repartitions.map((r) => ({
                        label: t("aliments.monthLabel", { count: r.moisCycle }),
                        valeur: formatPourcentagePrevision(Number(r.pourcentage)),
                      }))}
                      ariaLabel={t("aliments.monthlyRepartitionAria", { libelle: calibreLabel })}
                    />
                  </span>
                  {peutParametrer && (
                    <RepartitionMoisDialog
                      alimentPrevisionId={a.id}
                      libelle={calibreLabel}
                      dureeCycleMois={dureeCycleMois}
                      repartitions={a.repartitions}
                      onSaved={(repartitions) => {
                        setAliments((prev) =>
                          prev.map((x) => (x.id === a.id ? { ...x, repartitions } : x))
                        );
                        onDataChanged?.();
                      }}
                      trigger={
                        <Button variant="outline" size="sm">
                          {t("aliments.spreadButton")}
                        </Button>
                      }
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editingAliment && (
        <AlimentEditDialog
          aliment={editingAliment}
          open={!!editingAliment}
          onOpenChange={(next) => { if (!next) setEditingAliment(null); }}
          onUpdated={(updated) => {
            setAliments((prev) => prev.map((a) => (a.id === updated.id ? { ...updated, repartitions: a.repartitions } : a)));
            onDataChanged?.();
          }}
        />
      )}
    </div>
  );
}
