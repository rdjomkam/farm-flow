/**
 * Moteur Previsions — Charges mensuelles, base de repartition, quote-part.
 *
 * Etapes 5-7 (ADR-053 section 4) :
 *   calculerChargesMensuelles — Etape 5
 *   calculerBaseRepartition   — Etape 6, IMPLEMENTE LA DECISION 6 de l'ADR
 *   calculerQuotePartVague    — Etape 7
 *
 * Reference : docs/decisions/ADR-053-module-previsions.md
 */
import { Decimal } from "./decimal-config";
import { CategorieJournalPrevu } from "@/types";

export interface ChargeMensuelleInput {
  posteId: string;
  moisAbsolu: number;
  montantFCFA: Decimal;
}

export interface ChargesMensuellesResult {
  moisAbsolu: number;
  totalFCFA: Decimal;
  parPoste: { posteId: string; montantFCFA: Decimal }[];
}

/**
 * calculerChargesMensuelles — Etape 5 du moteur (ADR-053 section 4).
 *
 * Total des charges (`ChargeMensuellePrevue`) d'un mois absolu donne, par
 * poste. N'applique AUCUN filtre sur `PostePrevision.inclusBaseRepartition`
 * ici — c'est le role de `calculerBaseRepartition`, en aval (Etape 6) :
 * cette fonction restitue l'ensemble des charges du mois, quel que soit le
 * poste, pour rester reutilisable par un affichage qui a besoin du detail
 * complet (pas seulement de ce qui entre dans la quote-part).
 *
 * @param chargesMensuelles - toutes les lignes ChargeMensuellePrevue du scenario
 * @param moisAbsolu - mois absolu cible (0-based depuis ScenarioPrevision.dateDebutPlan)
 */
export function calculerChargesMensuelles(
  chargesMensuelles: ChargeMensuelleInput[],
  moisAbsolu: number
): ChargesMensuellesResult {
  const lignesDuMois = chargesMensuelles.filter((c) => c.moisAbsolu === moisAbsolu);
  const totalFCFA = lignesDuMois.reduce((sum, c) => sum.plus(c.montantFCFA), new Decimal(0));

  return {
    moisAbsolu,
    totalFCFA,
    parPoste: lignesDuMois.map((c) => ({ posteId: c.posteId, montantFCFA: c.montantFCFA })),
  };
}

export interface ChargePourBaseInput {
  montantFCFA: Decimal;
  /** PostePrevision.inclusBaseRepartition du poste associe a cette charge */
  inclusBaseRepartition: boolean;
}

export interface JournalEntryInput {
  montantFCFA: Decimal;
  categorie: CategorieJournalPrevu;
  /** JournalDepensePrevue.vaguePrevueId — null = depense generale du plan */
  vaguePrevueId: string | null;
}

/**
 * calculerBaseRepartition — Etape 6 du moteur. IMPLEMENTE LA DECISION 6 de
 * l'ADR-053 (correction du §5.7 des exigences fonctionnelles, actee, non
 * renegociee).
 *
 * `base_repartition` = charges logistique/exploitation dont
 * `inclusBaseRepartition = true` + journal operationnel GENERAL
 * (`categorie = OPERATIONNEL` ET `vaguePrevueId = null`).
 *
 * EXCLUT explicitement :
 * - toute charge dont `inclusBaseRepartition = false` ;
 * - toute ligne de journal `categorie = INVESTISSEMENT` (jamais
 *   quote-partee, ADR-053 §3.1) ;
 * - toute ligne de journal `categorie = OPERATIONNEL` DEJA AFFECTEE
 *   nominativement a une VaguePrevue (`vaguePrevueId` non nul) — la
 *   reintegrer dans la cle de repartition compterait ce montant deux fois
 *   (une fois en charge directe de cette vague, une fois de plus dilue
 *   dans la quote-part de toutes les vagues actives). C'est la correction
 *   du bug du §5.7 des exigences (qui prescrit `charges_operationnelles` =
 *   base + journal affecte, a l'envers) — le classeur Excel de reference
 *   applique deja cette version correcte (`Aliment par vague!T4:V4` pointe
 *   vers `Depenses!ligne 31`, la base sans le journal affecte, jamais vers
 *   la ligne 32).
 *
 * Cette fonction recoit VOLONTAIREMENT le journal et les charges NON
 * pre-filtres par l'appelant : le filtrage est fait ICI, pas en amont —
 * c'est ce qui rend la decision 6 verifiable par un test unitaire dedie
 * (piege identifie par la pre-analyse de la story PR1.3 : sur le jeu d'or,
 * `base_repartition == charges_operationnelles` sur les 21 mois des DEUX
 * fixtures, car le journal affecte y est nul partout — la recette PR1.4
 * seule NE PEUT PAS distinguer une implementation correcte d'une
 * implementation buguee du §5.7 ; seul un test dedie avec au moins une
 * ligne de journal `OPERATIONNEL` a `vaguePrevueId` non nul peut le
 * prouver).
 *
 * @param chargesLogistiqueEtExploitation - charges du mois (postes logistique/exploitation), NON filtrees sur inclusBaseRepartition
 * @param journalDuMois - toutes les lignes JournalDepensePrevue du mois, NON filtrees
 * @returns base_repartition du mois
 */
export function calculerBaseRepartition(
  chargesLogistiqueEtExploitation: ChargePourBaseInput[],
  journalDuMois: JournalEntryInput[]
): Decimal {
  const totalCharges = chargesLogistiqueEtExploitation
    .filter((c) => c.inclusBaseRepartition)
    .reduce((sum, c) => sum.plus(c.montantFCFA), new Decimal(0));

  const totalJournalGeneral = journalDuMois
    .filter(
      (j) => j.categorie === CategorieJournalPrevu.OPERATIONNEL && j.vaguePrevueId === null
    )
    .reduce((sum, j) => sum.plus(j.montantFCFA), new Decimal(0));

  return totalCharges.plus(totalJournalGeneral);
}

/**
 * calculerQuotePartVague — Etape 7 du moteur (ADR-053 section 4).
 *
 * Repartition EGALE de `base_repartition` sur les VaguePrevue actives d'un
 * mois donne. Deux (ou plus) vagues actives le meme mois -> chacune recoit
 * une part egale, calculee par agregation native sur le nombre de vagues
 * actives — jamais un lookup a resultat unique (cf. defaut d'affichage
 * benin, mais sans consequence sur les quantites, du classeur de
 * reference : ADR-053 section 7).
 *
 * Cas limite (ADR-053 section 8) : aucune vague active ce mois -> map
 * vide, jamais de division par zero. `base_repartition = 0` -> chaque
 * vague active recoit une quote-part de 0 (pas d'erreur).
 *
 * @param baseRepartitionMois - base_repartition du mois (calculerBaseRepartition)
 * @param vaguesActivesCeMois - identifiants des VaguePrevue actives ce mois
 * @returns quote-part de charges par vague active (meme montant pour chacune)
 */
export function calculerQuotePartVague(
  baseRepartitionMois: Decimal,
  vaguesActivesCeMois: string[]
): Map<string, Decimal> {
  const result = new Map<string, Decimal>();
  const nbVagues = vaguesActivesCeMois.length;

  if (nbVagues === 0) {
    return result;
  }

  const quotePart = baseRepartitionMois.dividedBy(nbVagues);
  for (const vagueId of vaguesActivesCeMois) {
    result.set(vagueId, quotePart);
  }

  return result;
}
