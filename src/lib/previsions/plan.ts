/**
 * Moteur Previsions — Plan d'empoissonnement.
 *
 * Etape 1 (ADR-053 section 4) : genererPlanEmpoissonnement.
 *
 * Reference : docs/decisions/ADR-053-module-previsions.md
 */
import { Decimal } from "./decimal-config";

export interface ParametresPlanInput {
  dateDebutPlan: Date;
  effectifAlevinsParVague: number;
  poidsMoyenInitialG: Decimal;
}

export interface VaguePrevueGeneree {
  /** 1-based, ordre de stockage dans le plan (pas un code — le code, ex. "V7", est attribue par l'appelant) */
  index: number;
  dateStockagePrevue: Date;
  effectifAlevinsPrevu: number;
  poidsMoyenInitialG: Decimal;
  /**
   * copie gelee de dureeCycleMois au moment de la generation de cette
   * VaguePrevue (ADR-053 decision 1) — un changement ulterieur de la
   * duree de cycle du scenario n'affecte jamais une VaguePrevue deja
   * generee.
   */
  dureeCycleMoisFigee: number;
}

/**
 * genererPlanEmpoissonnement — Etape 1 du moteur (ADR-053 section 4).
 *
 * Produit la liste theorique des VaguePrevue (dates de stockage) sur
 * l'horizon du plan, espacees de `frequenceStockageMois`
 * (`ParametresPrevision.frequenceStockageMois`, peut etre < 1 mois,
 * ADR-053 section 3.3).
 *
 * GAP DE MODELE signale au rapport de la story PR1.3 : ni l'ADR ni le
 * schema Prisma ne precisent l'algorithme exact de conversion d'un
 * espacement fractionnaire en mois vers des dates calendaires — ce point
 * n'est pas dans la liste des formules verifiees numeriquement contre le
 * jeu d'or par la pre-analyse. Interpretation retenue ici, a valider par
 * la recette (PR1.4) : le stockage n (n = 1, 2, ...) survient a
 * `n * frequenceStockageMois` mois apres `dateDebutPlan` ; l'avance en
 * mois fractionnaires applique d'abord la partie entiere des mois via
 * `setUTCMonth` (respecte les longueurs de mois calendaires reelles), puis
 * convertit la partie fractionnaire restante en jours en utilisant la
 * longueur du mois cible (apres avance entiere).
 *
 * @param parametres - dateDebutPlan, effectifAlevinsParVague, poidsMoyenInitialG (ParametresPrevision)
 * @param dureeCycleMois - duree de cycle du scenario au moment de la generation ; figee sur chaque VaguePrevue produite (ADR-053 decision 1)
 * @param frequenceStockageMois - espacement entre deux stockages successifs, en mois (peut etre fractionnaire, ParametresPrevision.frequenceStockageMois)
 * @param horizonMois - horizon du plan, en mois entiers, depuis dateDebutPlan
 * @returns liste ordonnee des vagues prevues theoriques (dates + effectifs) ; liste vide si frequenceStockageMois <= 0 ou horizonMois < 0 (horizonMois = 0 produit une seule vague, celle du mois de depart)
 */
export function genererPlanEmpoissonnement(
  parametres: ParametresPlanInput,
  dureeCycleMois: number,
  frequenceStockageMois: Decimal,
  horizonMois: number
): VaguePrevueGeneree[] {
  const result: VaguePrevueGeneree[] = [];

  if (frequenceStockageMois.lte(0) || horizonMois < 0) {
    return result;
  }

  let index = 1;
  let offsetMois = new Decimal(0);

  while (offsetMois.lte(horizonMois)) {
    result.push({
      index,
      dateStockagePrevue: addMonthsFractional(parametres.dateDebutPlan, offsetMois),
      effectifAlevinsPrevu: parametres.effectifAlevinsParVague,
      poidsMoyenInitialG: parametres.poidsMoyenInitialG,
      dureeCycleMoisFigee: dureeCycleMois,
    });
    index += 1;
    offsetMois = offsetMois.plus(frequenceStockageMois);
  }

  return result;
}

/**
 * calculerAlevinsACommander — ADR-053 decision 4 / exigences fonctionnelles
 * §4.3.
 *
 * `nb_alevins_a_commander = ceil(nb_poissons_a_vendre * (1 + marge_securite))`
 *
 * La marge de securite absorbe la mortalite (aucun taux de survie explicite
 * au MVP — ADR-053 decision 4) : elle gonfle le nombre d'alevins a acheter au
 * demarrage de la vague par rapport au nombre de poissons vises a la vente en
 * fin de cycle.
 *
 * UNITE — SITE UNIQUE DE CONVERSION (story PR2bis.3, famille ERR-139/ERR-141) :
 * `margeSecuriteAlevinsPct` est saisi et persiste sur l'echelle 0..100 (ex.
 * `10` pour "10 %"), exactement comme `PalierRemise.pourcentageRemise`
 * (`aliments.ts`, `appliquerPalierRemise`) — jamais une fraction 0..1. La
 * conversion en fraction (`/100`) est faite UNE SEULE FOIS, ici, jamais
 * dupliquee ailleurs dans le moteur ou l'orchestration.
 *
 * `Decimal` STRICT jusqu'au bout — jamais `Math.ceil`, jamais d'arithmetique
 * en `number` avant le `.ceil()` final : `Math.ceil(25000 * 1.1)` renvoie
 * `27501` au lieu de `27500` (imprecision binaire IEEE 754), ce qui casse la
 * vague V5 des deux fixtures de recette (`25000 * 1.1 = 27500` exactement).
 *
 * @param poissonsAVendreNb - nombre de poissons vises a la vente pour cette
 *   vague (`VaguePrevuePourCalcul.effectifAlevinsPrevu`, ADR-053 section 3.6 —
 *   meme grandeur que celle qui alimente `calculerRevenuPrevu` et
 *   `tonnageCibleKg` ; homonymie de nom deja signalee, non traitee par cette
 *   fonction ni par cette story)
 * @param margeSecuriteAlevinsPct - `ParametresPrevision.margeSecuriteAlevinsPct`, echelle 0..100
 * @returns nombre d'alevins a commander, entier (arrondi par exces)
 */
export function calculerAlevinsACommander(
  poissonsAVendreNb: number,
  margeSecuriteAlevinsPct: Decimal
): number {
  const fractionMarge = margeSecuriteAlevinsPct.dividedBy(100);
  return new Decimal(poissonsAVendreNb).times(new Decimal(1).plus(fractionMarge)).ceil().toNumber();
}

/**
 * Avance une date d'un nombre de mois fractionnaire (peut etre < 1).
 *
 * La partie entiere des mois avance via `setUTCMonth` (respecte les
 * longueurs de mois calendaires reelles) ; la partie fractionnaire
 * restante est convertie en jours en utilisant la longueur du mois cible
 * (apres avance entiere), puis ajoutee via `setUTCDate`.
 */
function addMonthsFractional(date: Date, months: Decimal): Date {
  const wholeMonths = months.trunc().toNumber();
  const fraction = months.minus(wholeMonths);

  const advanced = new Date(date.getTime());
  advanced.setUTCMonth(advanced.getUTCMonth() + wholeMonths);

  if (fraction.eq(0)) {
    return advanced;
  }

  const daysInTargetMonth = new Date(
    Date.UTC(advanced.getUTCFullYear(), advanced.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const extraDays = fraction.times(daysInTargetMonth).round().toNumber();
  advanced.setUTCDate(advanced.getUTCDate() + extraDays);

  return advanced;
}
