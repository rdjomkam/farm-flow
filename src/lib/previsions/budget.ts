/**
 * Moteur Previsions — Budget total du plan.
 *
 * Etape 12 (ADR-053 section 4) : calculerBudgetTotalPlan.
 *
 * Reference : docs/decisions/ADR-053-module-previsions.md
 */
import { Decimal } from "./decimal-config";

export interface BudgetTotalPlanInput {
  /** couts de production (Etape 8, calculerCoutProductionVague), un par VaguePrevue du plan — inclut deja la quote-part de charges de chaque vague */
  coutsProductionVagues: Decimal[];
  /**
   * charges du plan qui ne sont PAS deja capturees dans les couts de
   * production ci-dessus (typiquement les postes dont
   * `inclusBaseRepartition = false`, ou tout montant que l'appelant
   * choisit de suivre hors quote-part). A la charge de l'appelant de ne
   * fournir ici que des montants non deja quote-partes, pour eviter tout
   * double comptage avec `coutsProductionVagues`.
   */
  chargesHorsProduction: Decimal[];
  /** apports de tresorerie du plan (ApportCapital) — informatif, n'entre pas dans budgetTotalFCFA (un apport finance le budget, il n'en fait pas partie) */
  apports: Decimal[];
}

export interface BudgetTotalPlanResult {
  totalCoutsProductionFCFA: Decimal;
  totalChargesHorsProductionFCFA: Decimal;
  totalApportsFCFA: Decimal;
  /** totalCoutsProductionFCFA + totalChargesHorsProductionFCFA (jamais + totalApportsFCFA — un apport n'est pas un cout) */
  budgetTotalFCFA: Decimal;
}

/**
 * calculerBudgetTotalPlan — Etape 12 du moteur (ADR-053 section 4).
 *
 * Agregat toutes vagues, tous postes, tout l'horizon du plan.
 * Volontairement generique : recoit des listes de montants deja calcules
 * en amont par les autres fonctions du moteur (`calculerCoutProductionVague`
 * par vague, `calculerChargesMensuelles`/`calculerBaseRepartition` par
 * mois pour les charges hors quote-part) plutot qu'un `ScenarioPrevision`
 * complet — garantit l'absence d'I/O (ADR-053 section 4) et la
 * testabilite sans base de donnees.
 *
 * @param input - listes de montants deja calcules par les autres fonctions du moteur
 */
export function calculerBudgetTotalPlan(input: BudgetTotalPlanInput): BudgetTotalPlanResult {
  const sum = (arr: Decimal[]) => arr.reduce((s, v) => s.plus(v), new Decimal(0));

  const totalCoutsProductionFCFA = sum(input.coutsProductionVagues);
  const totalChargesHorsProductionFCFA = sum(input.chargesHorsProduction);
  const totalApportsFCFA = sum(input.apports);

  return {
    totalCoutsProductionFCFA,
    totalChargesHorsProductionFCFA,
    totalApportsFCFA,
    budgetTotalFCFA: totalCoutsProductionFCFA.plus(totalChargesHorsProductionFCFA),
  };
}
