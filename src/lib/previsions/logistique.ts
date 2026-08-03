/**
 * Moteur Previsions — Transport / logistique (voyages et couts associes).
 *
 * Comble le gap signale par la recette PR1.4 (docs/tests/rapport-story-PR1.4.md,
 * section 5) : aucune des 12 fonctions ADR-053 section 4 ne calcule un nombre
 * de voyages (`ceil(quantite / capacite)`) ni un cout de transport
 * (`voyages * coutUnitaireFCFA`), alors que `logistique.sousTotal` du jeu
 * d'or alimente directement `base_repartition`
 * (`baseRepartition = logistique.sousTotal + chargesExploitation`, verifie
 * exact sur 21/21 mois par la recette).
 *
 * GAP DE MODELE — COMBLE cote schema (migration
 * 20260803130000_add_transport_parametres_prevision, reserve n3 de
 * docs/reviews/review-sprint-PR1.md) : `ParametresPrevision` porte
 * desormais les 6 champs (`capaciteTransport{Aliments,Poissons,Alevins}*`,
 * `coutTransport{Aliments,Poissons,Alevins}FCFA`, valeurs par defaut =
 * jeu d'or "Parametres!B25:B30"). Ce fichier reste neanmoins a signature
 * explicite : ces valeurs continuent d'etre traitees ici comme des ENTREES
 * explicites des fonctions ci-dessous (jamais lues depuis Prisma a
 * l'interieur du moteur, ADR-053 decision 1) — la base est la SOURCE des
 * valeurs, l'appelant (couche API/queries) les charge et les passe en
 * argument, exactement comme `besoinTotalCycleKg` (types.ts) pour le besoin
 * en aliments.
 *
 * Reference : docs/decisions/ADR-053-module-previsions.md,
 * docs/tests/rapport-story-PR1.4.md (section 5, gap "logistique").
 */
import { Decimal } from "./decimal-config";

/**
 * calculerVoyages — nombre de voyages necessaires pour transporter une
 * quantite donnee, a raison d'une capacite fixe par voyage.
 *
 * Regle d'arrondi : `ceil`, comme pour les sacs (ADR-053 section 4,
 * "Typage numerique") — un voyage entame compte pour un voyage entier.
 *
 * Cas limite (documente ici, absent de l'ADR-053 section 8 puisque cette
 * fonction n'y est pas specifiee) : `capacite <= 0` -> AUCUNE capacite de
 * transport valide n'est configuree ; retourne `0` plutot que de propager
 * une division par zero (`NaN`/`Infinity`). Choix aligne sur le patron deja
 * en vigueur dans `aliments.ts` (`poidsSacKg.lte(0)` -> `sacs = 0`) : un
 * parametre de capacite invalide degrade silencieusement vers "aucun
 * voyage calculable", jamais une exception — ce n'est pas une violation
 * d'invariant de saisie (contrairement a une somme de repartition != 100%,
 * validation.ts), c'est un parametre externe potentiellement absent/mal
 * configure. `quantite <= 0` -> `0` voyage, obtenu naturellement par
 * `ceil(0 / capacite) = 0`, sans cas particulier necessaire.
 *
 * @param quantite - quantite a transporter (sacs, kg, ou nombre d'unites), Decimal pour rester fidele a une quantite potentiellement fractionnaire (ex. kg)
 * @param capacite - capacite de transport par voyage, meme unite que `quantite`
 * @returns nombre de voyages (entier, `ceil`), jamais negatif
 */
export function calculerVoyages(quantite: Decimal, capacite: Decimal): number {
  if (capacite.lte(0)) {
    return 0;
  }
  if (quantite.lte(0)) {
    return 0;
  }
  return quantite.dividedBy(capacite).ceil().toNumber();
}

/**
 * calculerCoutTransport — cout total de transport pour un nombre de
 * voyages donne.
 *
 * @param voyages - nombre de voyages (entier, sortie de `calculerVoyages`)
 * @param coutUnitaireFCFA - cout d'UN voyage
 * @returns cout total de transport (`voyages * coutUnitaireFCFA`)
 */
export function calculerCoutTransport(voyages: number, coutUnitaireFCFA: Decimal): Decimal {
  return coutUnitaireFCFA.times(voyages);
}

/**
 * Parametres de transport d'une categorie (aliments, poissons, ou alevins)
 * pour un mois donne — capacite et cout unitaire par voyage.
 *
 * GAP DE MODELE (voir en-tete de fichier) : ces valeurs ne sont portees par
 * aucun modele Prisma existant du module Previsions ; elles sont fournies
 * explicitement par l'appelant.
 */
export interface ParametresTransportInput {
  /** capacite de transport par voyage, meme unite que la quantite transportee de cette categorie */
  capacite: Decimal;
  /** cout d'UN voyage de cette categorie */
  coutUnitaireFCFA: Decimal;
}

export interface LogistiqueMensuelleInput {
  /** quantite d'aliments a transporter ce mois, en SACS (ADR-053 section 4 : sortie ceil de calculerBesoinAlimentMensuel, agregee) */
  quantiteAlimentsSacs: Decimal;
  transportAliments: ParametresTransportInput;
  /** quantite de poissons a transporter ce mois, en KG */
  quantitePoissonsKg: Decimal;
  transportPoissons: ParametresTransportInput;
  /** nombre d'alevins a transporter ce mois (mise en charge) */
  quantiteAlevinsNb: Decimal;
  transportAlevins: ParametresTransportInput;
}

export interface LogistiqueMensuelleResult {
  voyagesAliments: number;
  coutAlimentsFCFA: Decimal;
  voyagesPoissons: number;
  coutPoissonsFCFA: Decimal;
  voyagesAlevins: number;
  /** cout de transport des alevins — correspond a `logistique.transportAlevins` du jeu d'or */
  coutAlevinsFCFA: Decimal;
  /** `coutAlimentsFCFA + coutPoissonsFCFA + coutAlevinsFCFA` — correspond a `logistique.sousTotal` du jeu d'or, alimente directement `base_repartition` (calculerBaseRepartition, charges.ts) */
  sousTotalFCFA: Decimal;
}

/**
 * calculerLogistiqueMensuelle — voyages et couts de transport d'un mois,
 * pour les trois categories du jeu d'or (aliments, poissons, alevins).
 *
 * Combine `calculerVoyages` + `calculerCoutTransport` pour chaque
 * categorie, independamment les unes des autres (aucune categorie ne
 * depend d'une autre). `sousTotalFCFA` reproduit `logistique.sousTotal` du
 * jeu d'or, verifie par la recette PR1.4 comme l'entree directe de
 * `base_repartition` (`baseRepartition = logistique.sousTotal +
 * chargesExploitation`, exact sur 21/21 mois des deux scenarios).
 *
 * Cas limites : voir `calculerVoyages` (capacite <= 0 ou quantite <= 0 ->
 * 0 voyage, jamais de division par zero) ; ces cas se propagent
 * naturellement ici (0 voyage -> cout de cette categorie = 0, ne bloque
 * pas le calcul des deux autres categories).
 *
 * @param input - quantites du mois et parametres de transport (capacite + cout unitaire) des trois categories
 * @returns voyages et couts par categorie, plus le sous-total
 */
export function calculerLogistiqueMensuelle(
  input: LogistiqueMensuelleInput
): LogistiqueMensuelleResult {
  const voyagesAliments = calculerVoyages(input.quantiteAlimentsSacs, input.transportAliments.capacite);
  const coutAlimentsFCFA = calculerCoutTransport(
    voyagesAliments,
    input.transportAliments.coutUnitaireFCFA
  );

  const voyagesPoissons = calculerVoyages(input.quantitePoissonsKg, input.transportPoissons.capacite);
  const coutPoissonsFCFA = calculerCoutTransport(
    voyagesPoissons,
    input.transportPoissons.coutUnitaireFCFA
  );

  const voyagesAlevins = calculerVoyages(input.quantiteAlevinsNb, input.transportAlevins.capacite);
  const coutAlevinsFCFA = calculerCoutTransport(
    voyagesAlevins,
    input.transportAlevins.coutUnitaireFCFA
  );

  const sousTotalFCFA = coutAlimentsFCFA.plus(coutPoissonsFCFA).plus(coutAlevinsFCFA);

  return {
    voyagesAliments,
    coutAlimentsFCFA,
    voyagesPoissons,
    coutPoissonsFCFA,
    voyagesAlevins,
    coutAlevinsFCFA,
    sousTotalFCFA,
  };
}
