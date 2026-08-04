/**
 * src/lib/previsions/tableau-de-bord-helpers.ts
 *
 * Logique pure (testable sans base de donnees) pour le tableau de bord du
 * module Previsions (Sprint PR2, story PR2.4). Ce fichier NE fait PAS partie
 * du moteur recette (`src/lib/previsions/__tests__/recette`, 842 tests / 0
 * ecart) et ne modifie ni ne reimplemente aucune fonction de
 * `route-orchestration.ts` — il en reutilise uniquement `moisAbsoluDepuis`
 * telle quelle.
 *
 * --------------------------------------------------------------------------
 * "Tresorerie actuelle" — tranche par la pre-analyse PR2.4, section 2
 * --------------------------------------------------------------------------
 * Aucune donnee de solde de tresorerie REEL n'existe nulle part dans le
 * schema Prisma farm-flow (verifie exhaustivement par la pre-analyse) —
 * c'est un gap de meme nature que `src/lib/queries/dashboard.ts:218`
 * (ADR-053 §8.1) : ne JAMAIS l'inventer. La "tresorerie actuelle" du
 * tableau de bord est donc, par decision explicite, le solde PROJETE du
 * mois calendaire courant dans la serie deja renvoyee par
 * `calculerProjectionScenario` — jamais une donnee du reel. Si le mois
 * calendaire courant tombe hors de l'horizon du plan (avant son debut, ou
 * apres sa fin), aucune valeur numerique n'est renvoyee : un statut
 * explicite a la place, jamais un acces `mois[i]` hors bornes ni un chiffre
 * invente.
 */
import { moisAbsoluDepuis } from "./route-orchestration";

export { moisAbsoluDepuis };

export type TresorerieActuelleStatut = "disponible" | "avant_horizon" | "apres_horizon";

export interface TresorerieActuelleResult {
  statut: TresorerieActuelleStatut;
  /** Non-null uniquement si `statut === "disponible"`. */
  moisAbsolu: number | null;
  /** Non-null uniquement si `statut === "disponible"`. */
  soldeFCFA: number | null;
}

export interface MoisSoldeEntry {
  moisAbsolu: number;
  soldeFCFA: number;
}

/**
 * Localise le solde projete au mois calendaire courant, sans jamais
 * inventer de valeur ni acceder a un index hors bornes de la serie.
 *
 * @param dateDebutPlan Date de debut du plan (`ScenarioPrevision.dateDebutPlan`).
 * @param horizonMois Nombre total de mois de l'horizon (`ProjectionScenarioResult.horizonMois`).
 * @param moisSeries La serie `mois[]` de la projection (au moins `moisAbsolu` + `soldeFCFA`).
 * @param aujourdHui Injectable pour les tests — `new Date()` par defaut.
 */
export function calculerTresorerieActuelle(
  dateDebutPlan: Date,
  horizonMois: number,
  moisSeries: MoisSoldeEntry[],
  aujourdHui: Date = new Date()
): TresorerieActuelleResult {
  const moisCourant = moisAbsoluDepuis(dateDebutPlan, aujourdHui);

  if (moisCourant < 0) {
    return { statut: "avant_horizon", moisAbsolu: null, soldeFCFA: null };
  }
  if (moisCourant >= horizonMois) {
    return { statut: "apres_horizon", moisAbsolu: null, soldeFCFA: null };
  }

  const entree = moisSeries.find((m) => m.moisAbsolu === moisCourant);
  if (!entree) {
    // Ne devrait jamais survenir : la serie couvre 0..horizonMois-1 par
    // construction du moteur. Repli defensif plutot qu'un crash si un futur
    // appelant passe une serie partielle.
    return { statut: "apres_horizon", moisAbsolu: null, soldeFCFA: null };
  }

  return { statut: "disponible", moisAbsolu: moisCourant, soldeFCFA: entree.soldeFCFA };
}

const MOIS_COURTS_FR = [
  "janv.",
  "fevr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "aout",
  "sept.",
  "oct.",
  "nov.",
  "dec.",
];

/**
 * Libelle de mois calendaire lisible ("nov. 2026") a partir de
 * `dateDebutPlan` + un entier `moisAbsolu` (0 = `dateDebutPlan`). Aucun
 * helper existant ne le produisait avant cette story (pre-analyse PR2.4,
 * section 1.2, "second manque mineur"). Texte en dur en francais — meme
 * choix assume que PR2.3 (`format-previsions.ts`), pour ne pas casser le
 * test de completude i18n qui fige la liste des 36 namespaces existants.
 */
export function libelleMoisCalendaire(dateDebutPlan: Date, moisAbsolu: number): string {
  const date = new Date(dateDebutPlan.getFullYear(), dateDebutPlan.getMonth() + moisAbsolu, 1);
  return `${MOIS_COURTS_FR[date.getMonth()]} ${date.getFullYear()}`;
}
