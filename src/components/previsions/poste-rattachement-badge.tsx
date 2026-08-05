"use client";

/**
 * src/components/previsions/poste-rattachement-badge.tsx
 *
 * Presentation du rattachement `PostePrevision` -> `PosteReferentiel`
 * (ADR-053 §16.12, exigence A — visible PARTOUT ou un `PostePrevision`
 * apparait). Deux formes :
 *   - `PosteRattachementLigne` — forme "carte" (charges-tab.tsx, ecran
 *     d'administration), une ligne secondaire sous le libelle scenario.
 *   - `suffixeCompactRattachement` — forme "compacte" (listes denses,
 *     formules), un suffixe entre parentheses ajoute au libelle affiche.
 *
 * S'appuie exclusivement sur `calculerSignalRattachement`
 * (`src/lib/previsions/poste-rattachement.ts`, fonction pure) — ce fichier
 * ne fait QUE traduire le signal en JSX/texte, jamais de logique de
 * comparaison de libelles ici.
 */
import { useTranslations } from "next-intl";
import {
  calculerSignalRattachement,
  type PosteRattachementInfo,
} from "@/lib/previsions/poste-rattachement";

interface PosteRattachementLigneProps {
  libelleScenario: string;
  /**
   * Toujours present sur une donnee reelle (`PostePrevision.posteReferentielId`
   * NOT NULL en base, `include` cible partout ou `PostePrevisionDTO` est
   * construit). Optionnel ici uniquement en defense contre un appelant
   * (test, fixture) qui construirait un DTO incomplet — jamais affiche de
   * rattachement dans ce cas, plutot qu'un crash.
   */
  posteReferentiel: PosteRattachementInfo | undefined;
}

/** Forme "carte" — ligne secondaire affichee sous le libelle scenario-local. */
export function PosteRattachementLigne({ libelleScenario, posteReferentiel }: PosteRattachementLigneProps) {
  const t = useTranslations("previsions");
  if (!posteReferentiel) return null;
  const signal = calculerSignalRattachement(libelleScenario, posteReferentiel);
  if (signal.kind === "aucun") return null;
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {t("posteRattachement.label")} {signal.libelleReferentiel}
      {signal.kind === "inactif" && (
        <span className="ml-1 font-medium text-warning">
          · {t("posteRattachement.inactifSuffix")}
        </span>
      )}
    </p>
  );
}

/**
 * Forme "compacte" — a utiliser dans un composant client (necessite `t`
 * deja resolu, ex. `useTranslations("previsions")` de l'appelant) pour
 * suffixer un libelle affiche dans une liste dense ou une formule. Retourne
 * `null` si aucun signal n'est a afficher (cas majoritaire : coincidence,
 * actif).
 */
export function suffixeCompactRattachement(
  t: (key: string, values?: Record<string, string>) => string,
  libelleScenario: string,
  posteReferentiel: PosteRattachementInfo
): string | null {
  const signal = calculerSignalRattachement(libelleScenario, posteReferentiel);
  if (signal.kind === "aucun") return null;
  if (signal.kind === "inactif") {
    return t("posteRattachement.compactSuffixInactif");
  }
  return t("posteRattachement.compactSuffix", { libelle: signal.libelleReferentiel });
}

/**
 * Un `LigneRapprochementDTO.id`/`AgregatPosteDTO.cle` porte le format
 * compose `${clePrevue}::${moisAbsolu}` pour une ligne mensuelle (jamais
 * pour un agregat cumule, deja sans suffixe) — meme convention que
 * `cleDePoste` (`src/lib/previsions/rapprochement.ts`, `agregerParPoste`).
 * Retire le suffixe mois pour retrouver la cle stable a chercher dans
 * `posteRattachementParId` (ADR-053 §16.12, point 7 de la liste des
 * ecrans).
 */
export function posteIdDepuisLigneId(id: string): string {
  const idx = id.lastIndexOf("::");
  return idx === -1 ? id : id.slice(0, idx);
}

/**
 * Enrichit un libelle affiche dans les 3 vues de rapprochement
 * (mensuelle/cumulee/top-ecarts) avec le suffixe compact de rattachement,
 * si `cle` correspond a un `PostePrevision.id` connu de
 * `posteRattachementParId` — no-op (retourne `libelle` tel quel) pour toute
 * autre nature de ligne (granulometrie, vente, non-rapproche), dont la cle
 * n'apparait jamais dans cette table. Enrichissement PUREMENT en
 * presentation — jamais dans le moteur pur (`src/lib/previsions/
 * rapprochement.ts`).
 */
export function enrichirLibelleAvecRattachement(
  t: (key: string, values?: Record<string, string>) => string,
  cle: string,
  libelle: string,
  posteRattachementParId: Record<string, PosteRattachementInfo> | undefined
): string {
  const info = posteRattachementParId?.[posteIdDepuisLigneId(cle)];
  if (!info) return libelle;
  const suffixe = suffixeCompactRattachement(t, libelle, info);
  return suffixe ? `${libelle} (${suffixe})` : libelle;
}
