"use client";

/**
 * src/components/previsions/aliments-tab.tsx
 *
 * Onglet Granulometries — referentiel a deux niveaux calibre -> article(s)
 * (ADR-053 §12.3/§12.6). Cartes empilees mobile-first (pas de tableau).
 *
 * Ergonomie imposee par ADR-053 §12.6 : le cas nominal est UN SEUL article
 * par calibre — la carte se lit alors exactement comme une ligne simple (le
 * libelle affiche est celui de l'article, pas du calibre ; aucune mention de
 * part d'approvisionnement). La hierarchie a deux niveaux ne se revele que
 * lorsqu'un second article existe deja pour ce calibre — jamais avant.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, Percent, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Permission } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { ValeurCalculee } from "@/components/previsions/valeur-calculee";
import { AlimentFormDialog } from "@/components/previsions/aliment-form-dialog";
import { AlimentArticleFormDialog } from "@/components/previsions/aliment-article-form-dialog";
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
            // Le titre de la carte est toujours le calibre (ADR-053 §12.2.4 :
            // "le calibre n'a plus besoin de libellé propre, son affichage
            // vient de tailleGranule") — jamais le nom d'un article, qui
            // deviendrait arbitraire des qu'un second article existe pour ce
            // meme calibre. Le nom de l'article reste affiche, mais a son
            // niveau (sous-titre), pas au niveau du calibre (§12.6 : les
            // caracteristiques de l'article unique sont montrees directement,
            // sans liste imbriquee, mais elles restent celles de l'article).
            const articlePrincipal = a.articles[0];
            const isMulti = a.articles.length > 1;
            const calibreLabel = tStock(`produits.taillesGranule.${a.tailleGranule}`);
            return (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{calibreLabel}</p>
                    {!isMulti && articlePrincipal && (
                      <p className="text-sm text-muted-foreground truncate">
                        {t("aliments.articleSummary", {
                          libelle: articlePrincipal.libelle,
                          poids: Number(articlePrincipal.poidsSacKg),
                          prix: formatMontantPrevision(articlePrincipal.prixSacFCFA),
                        })}
                      </p>
                    )}
                  </div>
                  {peutParametrer && (
                    <button
                      type="button"
                      onClick={() => handleDelete(a.id)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center text-danger"
                      aria-label={t("aliments.deleteAria", { libelle: calibreLabel })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {isMulti && (
                  <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-sm font-medium text-foreground">{t("aliments.articlesTitle")}</p>
                    {a.articles.map((art) => (
                      <div key={art.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                        <span className="min-w-0 flex-1 truncate">{art.libelle}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {t("aliments.weightPrice", {
                            poids: Number(art.poidsSacKg),
                            prix: formatMontantPrevision(art.prixSacFCFA),
                          })}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {t("aliments.articlePart", {
                            value: formatPourcentagePrevision(Number(art.partApprovisionnementPct)),
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

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

                {peutParametrer && (
                  <div className="mt-2 flex justify-end">
                    <AlimentArticleFormDialog
                      alimentPrevisionId={a.id}
                      calibreLabel={calibreLabel}
                      articlesExistants={a.articles}
                      onSaved={(aliment) => {
                        setAliments((prev) => prev.map((x) => (x.id === aliment.id ? aliment : x)));
                        onDataChanged?.();
                      }}
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t("aliments.addArticleAria", { calibre: calibreLabel })}
                        >
                          <Plus className="h-4 w-4" />
                          {t("aliments.addArticleButton")}
                        </Button>
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
