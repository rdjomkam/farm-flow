/**
 * src/lib/previsions/format-previsions.ts
 *
 * Formatteurs d'affichage dedies au module Previsions (Sprint PR2, story
 * PR2.3, ADR-053 §7.4). Regroupes ICI plutot que dans `src/lib/format.ts`
 * (pre-analyse PR2.3 §3) : les regles de ce module divergent volontairement
 * de la convention d'affichage du reste de l'app —
 *
 * - `formatXAF` existant (src/lib/format.ts) affiche 2 decimales fixes.
 * - Le §7.4 impose 0 decimale sur les montants du module Previsions.
 *
 * Modifier `formatXAF` en place aurait change silencieusement l'affichage
 * de toutes les ventes/depenses/factures deja livrees — decision explicite
 * de creer un jeu de formatteurs distinct plutot que de risquer cette
 * regression. Reutilise par PR2.4 (tableau de bord, vue mensuelle).
 *
 * Toutes les fonctions acceptent `number | string | null | undefined` :
 * les champs `Decimal` du module Previsions peuvent circuler, selon la
 * route API, sous forme de `number` (frontiere convertie explicitement,
 * cf. `decimal-io.ts`) ou de string serialisee (Prisma.Decimal.toJSON()) —
 * cette tolerance evite un plantage silencieux si une route ne convertit
 * pas explicitement avant `NextResponse.json`.
 */

type NumeriqueEntrant = number | string | null | undefined;

/** Convertit une valeur numerique entrante (number | string | null | undefined) en number, ou null si non convertible. */
function versNombre(valeur: NumeriqueEntrant): number | null {
  if (valeur === null || valeur === undefined) return null;
  const n = typeof valeur === "number" ? valeur : Number(valeur);
  return Number.isFinite(n) ? n : null;
}

/**
 * Formate un montant en FCFA — 0 decimale, separateur de milliers, zero
 * affiche "–" (ADR-053 §7.4). Le signe negatif fait partie de la chaine
 * (ex. "-6 334 704 FCFA") ; la couleur rouge est une responsabilite du
 * composant appelant (`classeMontant`, ci-dessous), pas du formatage —
 * cohérent avec la seule convention trouvee dans le depot (`text-danger`
 * appliquee au niveau JSX, jamais dans une fonction de formatage).
 *
 * `avecUnite` (defaut `true`) controle si le suffixe " FCFA" est ajoute —
 * mis a `false` dans un contexte ou l'unite est deja portee une seule fois
 * ailleurs (ex. en-tete de ligne d'un tableau mois x indicateurs, plutot que
 * repetee dans chacune des cellules — cf. `previsions-mensuelles-tab.tsx`).
 *
 * @example formatMontantPrevision(15000) => "15 000 FCFA"
 * @example formatMontantPrevision(0) => "–"
 * @example formatMontantPrevision(-6334704) => "-6 334 704 FCFA"
 * @example formatMontantPrevision(null) => "–"
 * @example formatMontantPrevision(15000, "fr", false) => "15 000"
 */
export function formatMontantPrevision(
  valeur: NumeriqueEntrant,
  locale: string = "fr",
  avecUnite: boolean = true
): string {
  const n = versNombre(valeur);
  if (n === null) return "–";
  if (n === 0) return "–";
  const intlLocale = locale === "fr" ? "fr-FR" : locale === "en" ? "en-US" : locale;
  const formatted = new Intl.NumberFormat(intlLocale, {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
  return avecUnite ? `${formatted} FCFA` : formatted;
}

/**
 * Formate un entier (sacs, alevins, poissons, voyages) — separateur de
 * milliers, zero affiche "–". Reutilise `Intl.NumberFormat` (meme regle que
 * `formatNumber` de `src/lib/format.ts`, mais avec la regle "zero => tiret"
 * du §7.4, absente de `formatNumber`).
 *
 * @example formatEntierPrevision(15000) => "15 000"
 * @example formatEntierPrevision(0) => "–"
 */
export function formatEntierPrevision(valeur: NumeriqueEntrant, locale: string = "fr"): string {
  const n = versNombre(valeur);
  if (n === null) return "–";
  if (n === 0) return "–";
  const intlLocale = locale === "fr" ? "fr-FR" : locale === "en" ? "en-US" : locale;
  return new Intl.NumberFormat(intlLocale, {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/**
 * Formate un pourcentage a 1 decimale (ADR-053 §7.4). Consolide les 3
 * `formatPct` dupliques independamment dans les exports PDF
 * (`src/lib/export/pdf-cout-production.tsx`, `pdf-rapport-vague.tsx`,
 * `pdf-rapport-financier.tsx`, signale par la pre-analyse PR2.3 §3) — la
 * consolidation de ces 3 occurrences existantes reste hors perimetre strict
 * de cette story (dette signalee, pas traitee ici pour ne pas elargir le
 * perimetre UI de PR2.3).
 *
 * @example formatPourcentagePrevision(33.333) => "33,3 %"
 * @example formatPourcentagePrevision(0) => "0,0 %" (un taux a 0% reste un
 *   chiffre significatif, pas un "–" — contrairement aux montants/entiers)
 */
export function formatPourcentagePrevision(valeur: NumeriqueEntrant, locale: string = "fr"): string {
  const n = versNombre(valeur);
  if (n === null) return "–";
  const intlLocale = locale === "fr" ? "fr-FR" : locale === "en" ? "en-US" : locale;
  const formatted = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n);
  return `${formatted} %`;
}

/**
 * Formate un ratio a 1 decimale, sans unite (ADR-053 §7.4 / §11 amendement).
 * Utilise uniquement pour la mention discrete `sacsParTonneUnitaire` a cote
 * du poids du sac (`aliments-tab.tsx`) — jamais pour le coefficient de besoin
 * `sacsParTonneStandard`, qui a son propre libelle explicite ("Besoin : N
 * sacs/tonne de poisson") pour eviter de reproduire l'homonymie d'ADR-053 §11.
 *
 * @example formatRatioPrevision(66.666666) => "66,7"
 */
export function formatRatioPrevision(valeur: NumeriqueEntrant, locale: string = "fr"): string {
  const n = versNombre(valeur);
  if (n === null) return "–";
  const intlLocale = locale === "fr" ? "fr-FR" : locale === "en" ? "en-US" : locale;
  return new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n);
}

/**
 * Formate un tonnage a 1 decimale (ADR-053 §7.4) a partir d'un poids en kg.
 *
 * @example formatTonnagePrevision(17100) => "17,1 t"
 * @example formatTonnagePrevision(0) => "–"
 */
export function formatTonnagePrevision(kg: NumeriqueEntrant, locale: string = "fr"): string {
  const n = versNombre(kg);
  if (n === null) return "–";
  if (n === 0) return "–";
  const intlLocale = locale === "fr" ? "fr-FR" : locale === "en" ? "en-US" : locale;
  const formatted = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n / 1000);
  return `${formatted} t`;
}

/**
 * Classe Tailwind pour un montant — rouge (variable de theme R6) si negatif,
 * neutre sinon. Jamais de couleur en dur : `text-danger` est deja la
 * convention R6 du depot (cf. `step-groupes.tsx`).
 *
 * @example classeMontant(-100) => "text-danger"
 * @example classeMontant(100) => undefined
 */
export function classeMontant(valeur: NumeriqueEntrant): string | undefined {
  const n = versNombre(valeur);
  if (n === null) return undefined;
  return n < 0 ? "text-danger" : undefined;
}
