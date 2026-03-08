/**
 * Fonctions de calcul des indicateurs piscicoles.
 *
 * Fonctions pures sans dependance DB — utilisees par les API routes
 * et les composants pour calculer les indicateurs d'une vague.
 */

/**
 * Calcule le taux de survie en pourcentage.
 *
 * Formule : (nombreVivants / nombreInitial) * 100
 *
 * @param nombreVivants - Nombre de poissons encore vivants
 * @param nombreInitial - Nombre d'alevins au demarrage
 * @returns Pourcentage de survie, ou null si les donnees sont insuffisantes
 */
export function calculerTauxSurvie(
  nombreVivants: number | null,
  nombreInitial: number | null
): number | null {
  if (nombreVivants == null || nombreInitial == null || nombreInitial <= 0) {
    return null;
  }
  return (nombreVivants / nombreInitial) * 100;
}

/**
 * Calcule le gain de poids moyen en grammes.
 *
 * Formule : poidsMoyenActuel - poidsMoyenPrecedent
 *
 * @param poidsMoyenActuel - Poids moyen actuel en grammes
 * @param poidsMoyenPrecedent - Poids moyen precedent (ou initial) en grammes
 * @returns Gain en grammes, ou null si les donnees sont insuffisantes
 */
export function calculerGainPoids(
  poidsMoyenActuel: number | null,
  poidsMoyenPrecedent: number | null
): number | null {
  if (poidsMoyenActuel == null || poidsMoyenPrecedent == null) {
    return null;
  }
  return poidsMoyenActuel - poidsMoyenPrecedent;
}

/**
 * Calcule le SGR (Specific Growth Rate) — taux de croissance specifique en %/jour.
 *
 * Formule : ((ln(poidsFinal) - ln(poidsInitial)) / nombreJours) * 100
 *
 * @param poidsInitial - Poids moyen initial en grammes
 * @param poidsFinal - Poids moyen final en grammes
 * @param nombreJours - Nombre de jours entre les deux mesures
 * @returns SGR en %/jour, ou null si les donnees sont insuffisantes
 */
export function calculerSGR(
  poidsInitial: number | null,
  poidsFinal: number | null,
  nombreJours: number | null
): number | null {
  if (
    poidsInitial == null ||
    poidsFinal == null ||
    nombreJours == null ||
    poidsInitial <= 0 ||
    poidsFinal <= 0 ||
    nombreJours <= 0
  ) {
    return null;
  }
  return ((Math.log(poidsFinal) - Math.log(poidsInitial)) / nombreJours) * 100;
}

/**
 * Calcule le FCR (Feed Conversion Ratio) — indice de conversion alimentaire.
 *
 * Formule : totalAliment / gainBiomasse
 * Valeur ideale pour silures : 1.0 - 1.5
 *
 * @param totalAliment - Quantite totale d'aliment distribue en kg
 * @param gainBiomasse - Gain de biomasse en kg
 * @returns Ratio FCR, ou null si les donnees sont insuffisantes
 */
export function calculerFCR(
  totalAliment: number | null,
  gainBiomasse: number | null
): number | null {
  if (
    totalAliment == null ||
    gainBiomasse == null ||
    gainBiomasse <= 0
  ) {
    return null;
  }
  return totalAliment / gainBiomasse;
}

/**
 * Calcule la biomasse totale en kg.
 *
 * Formule : (poidsMoyen * nombreVivants) / 1000
 * (poidsMoyen en grammes, resultat en kg)
 *
 * @param poidsMoyen - Poids moyen d'un poisson en grammes
 * @param nombreVivants - Nombre de poissons vivants
 * @returns Biomasse en kg, ou null si les donnees sont insuffisantes
 */
export function calculerBiomasse(
  poidsMoyen: number | null,
  nombreVivants: number | null
): number | null {
  if (poidsMoyen == null || nombreVivants == null) {
    return null;
  }
  return (poidsMoyen * nombreVivants) / 1000;
}
