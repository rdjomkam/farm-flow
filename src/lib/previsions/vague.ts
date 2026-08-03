/**
 * Moteur Previsions — Cout de production et revenu previsionnel d'une vague.
 *
 * Etapes 8-9 (ADR-053 section 4) :
 *   calculerCoutProductionVague — Etape 8
 *   calculerRevenuPrevu         — Etape 9
 *
 * Reference : docs/decisions/ADR-053-module-previsions.md
 */
import { Decimal } from "./decimal-config";

/**
 * calculerCoutProductionVague — Etape 8 du moteur (ADR-053 section 4).
 *
 * Cout de production complet d'une VaguePrevue = cout aliment (Etape 4,
 * `calculerCoutAlimentVague`) + cout alevins + quote-part de charges
 * (Etape 7, `calculerQuotePartVague`, une seule valeur par vague active un
 * mois donne — a l'appelant d'agreger sur tout le cycle si necessaire,
 * cette fonction ne fait pas d'hypothese sur la periode couverte par
 * chaque montant fourni).
 *
 * @param coutAliment - cout aliment de la vague (calculerCoutAlimentVague)
 * @param coutAlevins - cout d'achat des alevins (effectifAlevinsPrevu x ParametresPrevision.prixAlevinUnitaireFCFA, calcule par l'appelant)
 * @param quotePartCharges - quote-part de charges attribuee a la vague (calculerQuotePartVague, agregee sur la periode voulue par l'appelant)
 */
export function calculerCoutProductionVague(
  coutAliment: Decimal,
  coutAlevins: Decimal,
  quotePartCharges: Decimal
): Decimal {
  return coutAliment.plus(coutAlevins).plus(quotePartCharges);
}

export interface RevenuPrevuResult {
  revenuFCFA: Decimal;
  biomasseKg: Decimal;
  /** true si poidsObjectifG <= 0 (cas limite ADR-053 section 8) */
  alerte: boolean;
}

/**
 * calculerRevenuPrevu — Etape 9 du moteur (ADR-053 section 4).
 *
 * Revenu previsionnel = effectif final (deja arrondi par `round` en amont
 * — ADR-053 section 4, "round pour les effectifs de poissons") x poids
 * moyen de vente (kg) x prix de vente au kg.
 *
 * NOMMAGE AMBIGU tranche ici (cas limite explicite de l'ADR-053 section 8,
 * "poidsMoyenVenteKg = 0") : le §3.3 de l'ADR-053 (`ParametresPrevision`)
 * ne connait pas de champ `poidsMoyenVenteKg`, seulement `poidsObjectifG`
 * (en GRAMMES). Interpretation retenue, a valider par la recette (PR1.4) :
 * "poidsMoyenVenteKg" du cas limite designe `poidsObjectifG` converti en
 * kg (`/1000`), utilise ici comme le poids moyen de vente vise. Aucune
 * division par ce parametre n'intervient structurellement dans cette
 * fonction (il n'apparait qu'au numerateur d'une multiplication) — le
 * garde `poidsObjectifG <= 0 -> biomasseKg = 0, revenuFCFA = 0, alerte =
 * true` est neanmoins applique explicitement en premier, pour respecter
 * a la lettre le cas limite specifie (ADR-053 section 8) meme en
 * l'absence de risque structurel de NaN/Infinity dans cette direction de
 * calcul.
 *
 * @param effectifFinal - nombre de poissons vivants estime en fin de cycle (deja arrondi par round en amont)
 * @param poidsObjectifG - poids moyen de vente vise, en GRAMMES (ParametresPrevision.poidsObjectifG)
 * @param prixVenteKgFCFA - prix de vente prevu au kg (ParametresPrevision.prixVenteKgFCFA)
 */
export function calculerRevenuPrevu(
  effectifFinal: number,
  poidsObjectifG: Decimal,
  prixVenteKgFCFA: Decimal
): RevenuPrevuResult {
  if (poidsObjectifG.lte(0)) {
    return { revenuFCFA: new Decimal(0), biomasseKg: new Decimal(0), alerte: true };
  }

  const poidsObjectifKg = poidsObjectifG.dividedBy(1000);
  const biomasseKg = poidsObjectifKg.times(effectifFinal);
  const revenuFCFA = biomasseKg.times(prixVenteKgFCFA);

  return { revenuFCFA, biomasseKg, alerte: false };
}
