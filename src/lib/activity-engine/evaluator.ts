/**
 * evaluator.ts — Moteur d'evaluation des regles d'activites.
 *
 * Evalue chaque RegleActivite contre le contexte de chaque vague active
 * et produit des RuleMatch quand les conditions sont remplies.
 *
 * Types de declencheurs implementes (8) :
 *   CALENDRIER, RECURRENT, SEUIL_POIDS, SEUIL_QUALITE,
 *   SEUIL_MORTALITE, STOCK_BAS, FCR_ELEVE, JALON
 */

import type { RegleActivite, Activite } from "@/types";
import { TypeDeclencheur, PhaseElevage, TypeReleve } from "@/types";
import type { RuleEvaluationContext, RuleMatch } from "@/types/activity-engine";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Ordre des phases pour les comparaisons min/max */
const PHASE_ORDER: Record<string, number> = {
  [PhaseElevage.ACCLIMATATION]: 0,
  [PhaseElevage.CROISSANCE_DEBUT]: 1,
  [PhaseElevage.JUVENILE]: 2,
  [PhaseElevage.GROSSISSEMENT]: 3,
  [PhaseElevage.FINITION]: 4,
  [PhaseElevage.PRE_RECOLTE]: 5,
};

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

/** Activite minimale necessaire pour la verification cooldown/firedOnce */
type ActiviteHistorique = Pick<
  Activite,
  "id" | "regleId" | "vagueId" | "dateDebut" | "createdAt"
>;

// ---------------------------------------------------------------------------
// Fonctions utilitaires
// ---------------------------------------------------------------------------

/**
 * Verifie si la phase courante est dans la plage [phaseMin, phaseMax].
 * phaseMin null = pas de borne basse
 * phaseMax null = pas de borne haute
 * EC-3.5 : phaseMin <= phaseMax est valide seulement si les deux sont non-null
 */
function isPhaseInRange(
  phase: string | null,
  phaseMin: string | null,
  phaseMax: string | null
): boolean {
  // Si aucun filtre de phase, la regle s'applique a toutes les phases
  if (!phaseMin && !phaseMax) return true;
  // Si la phase courante est inconnue, on ne peut pas filtrer → skip
  if (!phase) return false;

  const phaseOrd = PHASE_ORDER[phase] ?? -1;

  if (phaseMin) {
    const minOrd = PHASE_ORDER[phaseMin] ?? -1;
    if (phaseOrd < minOrd) return false;
  }

  if (phaseMax) {
    const maxOrd = PHASE_ORDER[phaseMax] ?? -1;
    // EC-3.5 : validation phaseMin <= phaseMax
    if (phaseMin) {
      const minOrd = PHASE_ORDER[phaseMin] ?? -1;
      if (minOrd > maxOrd) return false; // config invalide → skip
    }
    if (phaseOrd > maxOrd) return false;
  }

  return true;
}

/**
 * Retourne la derniere activite generee par cette regle sur cette vague,
 * ou null si aucune.
 */
function getLastFired(
  regleId: string,
  vagueId: string,
  historique: ActiviteHistorique[]
): ActiviteHistorique | null {
  const matches = historique
    .filter((a) => a.regleId === regleId && a.vagueId === vagueId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  return matches[0] ?? null;
}

/**
 * Nombre de jours ecoules depuis une date (UTC+1).
 */
function joursSince(date: Date): number {
  const WAT_OFFSET_MS = 1 * 60 * 60 * 1000;
  const nowWAT = new Date(Date.now() + WAT_OFFSET_MS);
  const dateWAT = new Date(date.getTime() + WAT_OFFSET_MS);
  return Math.floor(
    (nowWAT.getTime() - dateWAT.getTime()) / (1000 * 60 * 60 * 24)
  );
}

/**
 * Verifie si un doublon existe pour aujourd'hui (meme regle + vague + meme jour).
 * EC-3.1
 */
function hasTodayDuplicate(
  regleId: string,
  vagueId: string,
  historique: ActiviteHistorique[]
): boolean {
  const WAT_OFFSET_MS = 1 * 60 * 60 * 1000;
  const todayWAT = new Date(Date.now() + WAT_OFFSET_MS);
  const todayStr = todayWAT.toISOString().slice(0, 10); // YYYY-MM-DD

  return historique.some((a) => {
    if (a.regleId !== regleId || a.vagueId !== vagueId) return false;
    const aDateWAT = new Date(a.createdAt.getTime() + WAT_OFFSET_MS);
    return aDateWAT.toISOString().slice(0, 10) === todayStr;
  });
}

// ---------------------------------------------------------------------------
// Evaluateurs par type de declencheur
// ---------------------------------------------------------------------------

/**
 * CALENDRIER : jourDeclenchement relatif au debut de vague.
 * Se declenche quand joursEcoules >= conditionValeur.
 * conditionValeur null = se declenche immediatement (J+0).
 */
function evalCalendrier(
  regle: RegleActivite,
  ctx: RuleEvaluationContext
): boolean {
  const jour = regle.conditionValeur ?? 0;
  return ctx.joursEcoules >= jour;
}

/**
 * RECURRENT : se declenche si aucune activite de cette regle+vague n'a ete
 * generee dans les intervalleJours derniers jours.
 * intervalleJours null = jamais recurrent (EC-3.12 : condition null = match toujours).
 */
function evalRecurrent(
  regle: RegleActivite,
  ctx: RuleEvaluationContext,
  historique: ActiviteHistorique[]
): boolean {
  const intervalleJours = regle.intervalleJours;
  if (intervalleJours == null) return true; // EC-3.12

  const lastFired = getLastFired(regle.id, ctx.vague.id, historique);
  if (!lastFired) return true; // Jamais declenche → declencher

  const joursSinceLastFired = joursSince(new Date(lastFired.createdAt));
  return joursSinceLastFired >= intervalleJours;
}

/**
 * SEUIL_POIDS : poidsMoyen >= conditionValeur.
 * conditionValeur null = match toujours.
 */
function evalSeuilPoids(
  regle: RegleActivite,
  ctx: RuleEvaluationContext
): boolean {
  if (regle.conditionValeur == null) return true; // EC-3.12
  if (ctx.indicateurs.poidsMoyen == null) return false;
  return ctx.indicateurs.poidsMoyen >= regle.conditionValeur;
}

/**
 * SEUIL_QUALITE : valeur pH ou temp hors range [conditionValeur, conditionValeur2].
 * Evalue le dernier releve qualite eau.
 * conditionValeur null ET conditionValeur2 null = match toujours.
 */
function evalSeuilQualite(
  regle: RegleActivite,
  ctx: RuleEvaluationContext
): boolean {
  const min = regle.conditionValeur;
  const max = regle.conditionValeur2;

  // EC-3.12 : conditions null = match toujours
  if (min == null && max == null) return true;

  // Cherche le dernier releve qualite eau parmi les 5 derniers
  const dernierQualite = ctx.derniersReleves.find(
    (r) => r.typeReleve === TypeReleve.QUALITE_EAU
  );
  if (!dernierQualite) return false;

  // Verifier pH ou temperature selon les seuils fournis
  // Si min et max sont definis : valeur hors [min, max] = alerte
  const checkValue = (val: number | null): boolean => {
    if (val == null) return false;
    if (min != null && val < min) return true;
    if (max != null && val > max) return true;
    return false;
  };

  return (
    checkValue(dernierQualite.ph) ||
    checkValue(dernierQualite.temperature) ||
    checkValue(dernierQualite.oxygene) ||
    checkValue(dernierQualite.ammoniac)
  );
}

/**
 * SEUIL_MORTALITE : taux de mortalite cumulee > conditionValeur (%).
 * conditionValeur null = match toujours.
 */
function evalSeuilMortalite(
  regle: RegleActivite,
  ctx: RuleEvaluationContext
): boolean {
  if (regle.conditionValeur == null) return true; // EC-3.12
  if (ctx.indicateurs.tauxMortaliteCumule == null) return false;
  return ctx.indicateurs.tauxMortaliteCumule > regle.conditionValeur;
}

/**
 * STOCK_BAS : jours de stock restants < conditionValeur.
 * Estime les jours restants en divisant le stock actuel par la consommation
 * journaliere (si disponible). Se base sur le seuilAlerte comme proxy.
 * conditionValeur null = match si au moins un produit est en alerte.
 */
function evalStockBas(
  regle: RegleActivite,
  ctx: RuleEvaluationContext
): boolean {
  const seuilJours = regle.conditionValeur;

  if (seuilJours == null) {
    // EC-3.12 : match si au moins un produit est en alerte
    return ctx.stock.some((s) => s.estEnAlerte);
  }

  // Cherche les produits en alerte dont le stock represente moins de seuilJours
  // de consommation. En l'absence de donnees de consommation journaliere,
  // on se base sur le ratio stock / seuilAlerte.
  return ctx.stock.some((s) => {
    if (!s.estEnAlerte) return false;
    // Estimation : si seuilAlerte > 0, on peut estimer le nombre de jours
    if (s.produit.seuilAlerte <= 0) return true;
    // jours_restants ≈ quantiteActuelle / (seuilAlerte / conditionValeur)
    // i.e. si stock < seuilAlerte → deja en alerte → condition remplie
    const jourEstimes =
      s.quantiteActuelle > 0
        ? (s.quantiteActuelle / s.produit.seuilAlerte) * seuilJours
        : 0;
    return jourEstimes < seuilJours;
  });
}

/**
 * FCR_ELEVE : FCR courant > conditionValeur.
 * conditionValeur null = match toujours si FCR disponible.
 */
function evalFcrEleve(
  regle: RegleActivite,
  ctx: RuleEvaluationContext
): boolean {
  if (regle.conditionValeur == null) return ctx.indicateurs.fcr != null; // EC-3.12
  if (ctx.indicateurs.fcr == null) return false;
  return ctx.indicateurs.fcr > regle.conditionValeur;
}

/**
 * JALON : joursEcoules / dureeElevageJours >= conditionValeur/100.
 * dureeElevageJours = configElevage.dureeEstimeeCycle si disponible, sinon 180j.
 * conditionValeur null = match toujours.
 */
function evalJalon(
  regle: RegleActivite,
  ctx: RuleEvaluationContext
): boolean {
  if (regle.conditionValeur == null) return true; // EC-3.12

  // La duree estimee du cycle est dans configElevage (non expose dans le contexte simplifie)
  // On utilise une valeur par defaut de 180j (benchmark Clarias gariepinus)
  const dureeEstimee = 180;
  const progression = (ctx.joursEcoules / dureeEstimee) * 100;
  return progression >= regle.conditionValeur;
}

// ---------------------------------------------------------------------------
// Fonction principale
// ---------------------------------------------------------------------------

/**
 * Evalue un ensemble de regles contre les contextes de vagues.
 *
 * Pour chaque vague active, evalue chaque regle applicable
 * et retourne les RuleMatch.
 *
 * Regles de skip :
 * - Vague avec 0 vivants (EC-3.9)
 * - Regle inactive (isActive = false)
 * - Phase hors plage [phaseMin, phaseMax] (EC-3.5)
 * - Doublon meme jour (EC-3.1)
 * - firedOnce = true pour les SEUIL_* (EC-3.2)
 *
 * @param contextes  - Contextes d'evaluation des vagues actives
 * @param regles     - Regles actives du site + regles globales
 * @param historique - Historique des activites recentes pour le cooldown
 * @returns          Liste des RuleMatch produits
 */
export function evaluateRules(
  contextes: RuleEvaluationContext[],
  regles: RegleActivite[],
  historique: ActiviteHistorique[]
): RuleMatch[] {
  const matches: RuleMatch[] = [];

  for (const ctx of contextes) {
    // EC-3.9 : skip vagues sans vivants
    if (
      ctx.indicateurs.nombreVivants !== null &&
      ctx.indicateurs.nombreVivants <= 0
    ) {
      continue;
    }

    for (const regle of regles) {
      // Skip regles inactives
      if (!regle.isActive) continue;

      // EC-3.2 : skip pour SEUIL_* si firedOnce = true
      const seuilTypes = [
        TypeDeclencheur.SEUIL_POIDS,
        TypeDeclencheur.SEUIL_QUALITE,
        TypeDeclencheur.SEUIL_MORTALITE,
        TypeDeclencheur.FCR_ELEVE,
        TypeDeclencheur.STOCK_BAS,
      ];
      if (
        seuilTypes.includes(regle.typeDeclencheur as TypeDeclencheur) &&
        regle.firedOnce
      ) {
        continue;
      }

      // Filtre de phase (EC-3.5)
      if (!isPhaseInRange(ctx.phase, regle.phaseMin, regle.phaseMax)) {
        continue;
      }

      // EC-3.1 : deduplication meme jour
      if (hasTodayDuplicate(regle.id, ctx.vague.id, historique)) {
        continue;
      }

      // Evaluation selon le type de declencheur
      let triggered = false;

      switch (regle.typeDeclencheur as TypeDeclencheur) {
        case TypeDeclencheur.CALENDRIER:
          triggered = evalCalendrier(regle, ctx);
          break;
        case TypeDeclencheur.RECURRENT:
          triggered = evalRecurrent(regle, ctx, historique);
          break;
        case TypeDeclencheur.SEUIL_POIDS:
          triggered = evalSeuilPoids(regle, ctx);
          break;
        case TypeDeclencheur.SEUIL_QUALITE:
          triggered = evalSeuilQualite(regle, ctx);
          break;
        case TypeDeclencheur.SEUIL_MORTALITE:
          triggered = evalSeuilMortalite(regle, ctx);
          break;
        case TypeDeclencheur.STOCK_BAS:
          triggered = evalStockBas(regle, ctx);
          break;
        case TypeDeclencheur.FCR_ELEVE:
          triggered = evalFcrEleve(regle, ctx);
          break;
        case TypeDeclencheur.JALON:
          triggered = evalJalon(regle, ctx);
          break;
        default:
          triggered = false;
      }

      if (triggered) {
        // Score : priorite de la regle (1 = haute → score eleve)
        // EC-3.3 : priorite la plus basse = plus urgent
        const score = (11 - regle.priorite) * 10;

        matches.push({
          regle,
          vague: ctx.vague,
          context: ctx,
          score,
        });
      }
    }
  }

  // Tri par score decroissant (les plus urgents en premier)
  matches.sort((a, b) => b.score - a.score);

  return matches;
}
