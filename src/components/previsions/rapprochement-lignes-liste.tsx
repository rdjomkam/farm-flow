"use client";

/**
 * src/components/previsions/rapprochement-lignes-liste.tsx
 *
 * Rendu partage d'une liste de `LigneRapprochementDTO` (Sprint PR3, story
 * PR3.7) — utilise par la vue mensuelle et la vue cumulee (memes colonnes :
 * poste, prevu, reel, ecart, ecart %, sens). Mobile-first (regle projet) :
 * cartes empilees sous `md:`, tableau a partir de `md:`. AUCUNE comparaison
 * `prevu`/`reel` n'est refaite ici — `sens`/`couleur` sont deja portes par
 * chaque ligne (calcules cote serveur, `rapprochement-dto.ts`).
 *
 * Distinction `SANS_SOURCE_REELLE` vs `reel = 0` (ADR-053 §15.1) : une
 * ligne dont `reel === null` affiche EXPLICITEMENT le libelle "pas de
 * source reelle" (i18n `rapprochementTab.sansSourceReelle`), jamais un
 * montant ni un simple tiret qui la confondrait avec un `reel = 0`
 * legitime.
 *
 * Distinction `prevu = 0 && reel > 0` (depense non budgetee, ADR-053
 * §15.5) : `ecartPct === null` alors que `ecartAbsolu !== null` — ce cas
 * affiche un badge "N/A" sur la colonne Ecart %, jamais "0 %"/"∞"/"NaN".
 */
import { useTranslations } from "next-intl";
import { formatMontantPrevision, formatPourcentagePrevision } from "@/lib/previsions/format-previsions";
import { classeFondCouleur, classeTexteCouleur } from "@/components/previsions/rapprochement-ui-helpers";
import type { AgregatEcartDTO, LigneRapprochementDTO } from "@/components/previsions/rapprochement-types";
import { cn } from "@/lib/utils";

/** Affiche `reel` en respectant la distinction null (pas de source) vs 0 (donnee reelle legitime). */
function CelluleReel({ ligne }: { ligne: LigneRapprochementDTO }) {
  const t = useTranslations("previsions");
  if (ligne.reel === null) {
    return <span className="text-xs italic text-muted-foreground">{t("rapprochementTab.sansSourceReelle")}</span>;
  }
  return <span>{formatMontantPrevision(ligne.reel)}</span>;
}

/** Affiche `ecartPct`, jamais "0 %"/"∞"/"NaN" quand il n'existe aucune base de comparaison (prevu = 0). */
function CelluleEcartPct({ ligne }: { ligne: LigneRapprochementDTO }) {
  const t = useTranslations("previsions");
  if (ligne.ecartPct === null) {
    return <span title={t("rapprochementTab.nonBudgete")}>{t("rapprochementTab.nonApplicable")}</span>;
  }
  return <span>{formatPourcentagePrevision(ligne.ecartPct * 100)}</span>;
}

function BadgeSens({ ligne }: { ligne: LigneRapprochementDTO }) {
  const t = useTranslations("previsions");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        classeFondCouleur(ligne.couleur),
        classeTexteCouleur(ligne.couleur)
      )}
    >
      {t(`rapprochementTab.sens.${ligne.sens}`)}
    </span>
  );
}

interface RapprochementLignesListeProps {
  lignes: LigneRapprochementDTO[];
  total?: AgregatEcartDTO;
  emptyLabel: string;
}

export function RapprochementLignesListe({ lignes, total, emptyLabel }: RapprochementLignesListeProps) {
  const t = useTranslations("previsions");

  if (lignes.length === 0 && !total) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div>
      {/* Cartes empilees — mobile (regle projet : pas de tableau sous md:) */}
      <div className="space-y-2 md:hidden">
        {lignes.map((l) => (
          <div key={l.id} className="rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-foreground">{l.libelle}</span>
              <BadgeSens ligne={l} />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t("rapprochementTab.columns.prevu")}</dt>
              <dd className="text-right tabular-nums">{formatMontantPrevision(l.prevu)}</dd>
              <dt className="text-muted-foreground">{t("rapprochementTab.columns.reel")}</dt>
              <dd className="text-right tabular-nums">
                <CelluleReel ligne={l} />
              </dd>
              <dt className="text-muted-foreground">{t("rapprochementTab.columns.ecartAbsolu")}</dt>
              <dd className={cn("text-right tabular-nums", classeTexteCouleur(l.couleur))}>
                {l.ecartAbsolu === null ? "–" : formatMontantPrevision(l.ecartAbsolu)}
              </dd>
              <dt className="text-muted-foreground">{t("rapprochementTab.columns.ecartPct")}</dt>
              <dd className="text-right tabular-nums">
                <CelluleEcartPct ligne={l} />
              </dd>
            </dl>
          </div>
        ))}
        {total && (
          <div className="rounded-lg border-2 border-border bg-muted/40 p-3">
            <p className="text-sm font-semibold text-foreground">{t("rapprochementTab.totalRow")}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t("rapprochementTab.columns.prevu")}</dt>
              <dd className="text-right font-semibold tabular-nums">{formatMontantPrevision(total.totalPrevu)}</dd>
              <dt className="text-muted-foreground">{t("rapprochementTab.columns.reel")}</dt>
              <dd className="text-right font-semibold tabular-nums">{formatMontantPrevision(total.totalReel)}</dd>
              <dt className="text-muted-foreground">{t("rapprochementTab.columns.ecartAbsolu")}</dt>
              <dd className="text-right font-semibold tabular-nums">{formatMontantPrevision(total.totalEcartAbsolu)}</dd>
            </dl>
          </div>
        )}
      </div>

      {/* Tableau — a partir de md: uniquement */}
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("rapprochementTab.columns.libelle")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("rapprochementTab.columns.prevu")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("rapprochementTab.columns.reel")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("rapprochementTab.columns.ecartAbsolu")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("rapprochementTab.columns.ecartPct")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("rapprochementTab.columns.sens")}</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id} className="border-b border-border/60 hover:bg-muted/40">
                <td className="px-3 py-2 font-medium">{l.libelle}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMontantPrevision(l.prevu)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <CelluleReel ligne={l} />
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums", classeTexteCouleur(l.couleur))}>
                  {l.ecartAbsolu === null ? "–" : formatMontantPrevision(l.ecartAbsolu)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <CelluleEcartPct ligne={l} />
                </td>
                <td className="px-3 py-2 text-right">
                  <BadgeSens ligne={l} />
                </td>
              </tr>
            ))}
          </tbody>
          {total && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                <td className="px-3 py-2">{t("rapprochementTab.totalRow")}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMontantPrevision(total.totalPrevu)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMontantPrevision(total.totalReel)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMontantPrevision(total.totalEcartAbsolu)}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
