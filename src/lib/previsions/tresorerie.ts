/**
 * Moteur Previsions — Tresorerie previsionnelle mensuelle et point bas.
 *
 * Etapes 10-11 (ADR-053 section 4) :
 *   calculerTresorerieMensuelle — Etape 10
 *   calculerPointBasTresorerie  — Etape 11
 *
 * Reference : docs/decisions/ADR-053-module-previsions.md
 */
import { Decimal } from "./decimal-config";

/**
 * calculerTresorerieMensuelle — Etape 10 du moteur (ADR-053 section 4).
 *
 * `tresorerie[n] = tresorerie[n-1] + revenus[n] - depenses[n] + apports[n]`
 * — cumul simple, verifie exact sur les 21 mois du jeu d'or (solde initial
 * = 0, story PR1.3).
 *
 * @param revenusMois - revenus encaisses ce mois (Vente reelle rapprochee + calculerRevenuPrevu)
 * @param depensesMois - depenses decaissees ce mois (cout aliment + cout alevins + charges, hors quote-part deja capturee dans les couts de production — a l'appelant de ne pas compter un montant deux fois)
 * @param apportsMois - apports de tresorerie ce mois (ApportCapital, `CAPITAL` et `CREDIT` confondus — un credit encaisse est un apport de tresorerie, jamais un investissement, ADR-053 section 3.1/7)
 * @param soldeMoisPrecedent - solde cumule du mois precedent (0 pour le premier mois du plan)
 * @returns solde cumule de tresorerie a la fin de ce mois
 */
export function calculerTresorerieMensuelle(
  revenusMois: Decimal,
  depensesMois: Decimal,
  apportsMois: Decimal,
  soldeMoisPrecedent: Decimal
): Decimal {
  return soldeMoisPrecedent.plus(revenusMois).minus(depensesMois).plus(apportsMois);
}

export interface TresorerieMoisResult {
  moisAbsolu: number;
  soldeFCFA: Decimal;
}

/**
 * genererSerieTresorerie — helper de cascade.
 *
 * N'est PAS l'une des 12 fonctions listees explicitement au tableau de
 * l'ADR-053 section 4 : ajoutee ici pour eviter de dupliquer la boucle de
 * cumul (`calculerTresorerieMensuelle` appliquee mois par mois) dans
 * chaque appelant. Reste une fonction pure, meme contrat de purete que le
 * reste du moteur (aucun I/O), et reutilise exclusivement
 * `calculerTresorerieMensuelle` — elle n'introduit aucune formule
 * nouvelle.
 *
 * @param moisOrdonnes - series de (revenus, depenses, apports) par mois absolu, DEJA triees par ordre croissant de moisAbsolu (a la charge de l'appelant)
 * @param soldeInitial - solde de depart (0 dans le jeu d'or, ADR-053 section 4)
 */
export function genererSerieTresorerie(
  moisOrdonnes: { moisAbsolu: number; revenus: Decimal; depenses: Decimal; apports: Decimal }[],
  soldeInitial: Decimal = new Decimal(0)
): TresorerieMoisResult[] {
  const result: TresorerieMoisResult[] = [];
  let solde = soldeInitial;

  for (const mois of moisOrdonnes) {
    solde = calculerTresorerieMensuelle(mois.revenus, mois.depenses, mois.apports, solde);
    result.push({ moisAbsolu: mois.moisAbsolu, soldeFCFA: solde });
  }

  return result;
}

/**
 * calculerEpargne — story PR2q.2 (ADR-053, jeu d'or "Paramètres!B36").
 *
 * `epargne(M) = max(0, resultat(M)) x tauxEpargnePct` — jamais un montant
 * negatif : un mois deficitaire n'epargne rien, il ne "deseparge" pas non
 * plus (pas de compensation entre mois, chaque mois est independant).
 *
 * `tauxEpargnePct` est sur l'echelle 0..100 (meme convention que
 * `margeSecuriteAlevinsPct`, ADR-053 decision 4) — l'appelant est
 * responsable de la conversion depuis toute autre echelle (ex. fraction
 * 0..1 du jeu d'or, `pctFixtureVersMoteur` cote recette) AVANT d'appeler
 * cette fonction : un seul site de conversion d'echelle, jamais deux.
 *
 * Fonction pure (aucun I/O), Decimal strict (jamais `number`,
 * `decimal-config.ts`) — verifiee numeriquement par la pre-analyse sur les
 * 21 mois des deux fixtures du jeu d'or, ecart 0,0 partout.
 *
 * @param resultat - `resultatFCFA` du mois (peut etre negatif)
 * @param tauxEpargnePct - taux d'epargne du scenario, echelle 0..100
 * @returns montant epargne du mois, toujours >= 0
 */
export function calculerEpargne(resultat: Decimal, tauxEpargnePct: Decimal): Decimal {
  return Decimal.max(0, resultat).times(tauxEpargnePct).dividedBy(100);
}

export interface PointBasTresorerieResult {
  pointBasFCFA: Decimal;
  moisAbsolu: number;
}

/**
 * calculerPointBasTresorerie — Etape 11 du moteur (ADR-053 section 4,
 * §7.2 des exigences fonctionnelles).
 *
 * Minimum de la serie de tresorerie cumulee et le mois ou il survient —
 * condition d'exercice du besoin de financement. En cas d'egalite entre
 * plusieurs mois, retient le PREMIER mois (dans l'ordre de la serie
 * fournie) qui atteint ce minimum.
 *
 * @param serieTresorerieMensuelle - serie de soldes cumules (typiquement le resultat de genererSerieTresorerie)
 * @returns null si la serie est vide (aucun point bas defini)
 */
export function calculerPointBasTresorerie(
  serieTresorerieMensuelle: TresorerieMoisResult[]
): PointBasTresorerieResult | null {
  if (serieTresorerieMensuelle.length === 0) {
    return null;
  }

  let min = serieTresorerieMensuelle[0];
  for (const mois of serieTresorerieMensuelle) {
    if (mois.soldeFCFA.lt(min.soldeFCFA)) {
      min = mois;
    }
  }

  return { pointBasFCFA: min.soldeFCFA, moisAbsolu: min.moisAbsolu };
}
