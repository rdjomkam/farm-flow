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

/**
 * Calcule la densite de biomasse en kg/m³.
 *
 * Formule : biomasse(kg) / volume(m³)
 * Volume du bac est en litres dans la DB → conversion en m³ (÷ 1000).
 *
 * @param biomasse - Biomasse en kg
 * @param volumeLitres - Volume du bac en litres
 * @returns Densite en kg/m³, ou null si donnees insuffisantes
 */
export function calculerDensite(
  biomasse: number | null,
  volumeLitres: number | null
): number | null {
  if (biomasse == null || volumeLitres == null || volumeLitres <= 0) {
    return null;
  }
  const volumeM3 = volumeLitres / 1000;
  return biomasse / volumeM3;
}

/**
 * Calcule le taux de mortalite en pourcentage.
 *
 * Formule : (totalMorts / nombreInitial) × 100
 *
 * @param totalMorts - Nombre total de morts
 * @param nombreInitial - Nombre initial d'alevins
 * @returns Pourcentage de mortalite, ou null si donnees insuffisantes
 */
export function calculerTauxMortalite(
  totalMorts: number | null,
  nombreInitial: number | null
): number | null {
  if (totalMorts == null || nombreInitial == null || nombreInitial <= 0) {
    return null;
  }
  return (totalMorts / nombreInitial) * 100;
}

/**
 * Calcule le gain de biomasse quotidien en kg/jour.
 *
 * Formule : (biomasseFin - biomasseDebut) / jours
 *
 * @param biomasseDebut - Biomasse initiale en kg
 * @param biomasseFin - Biomasse finale en kg
 * @param jours - Nombre de jours ecoules
 * @returns Gain quotidien en kg/jour, ou null si donnees insuffisantes
 */
export function calculerGainQuotidien(
  biomasseDebut: number | null,
  biomasseFin: number | null,
  jours: number | null
): number | null {
  if (
    biomasseDebut == null ||
    biomasseFin == null ||
    jours == null ||
    jours <= 0
  ) {
    return null;
  }
  return (biomasseFin - biomasseDebut) / jours;
}

/**
 * Calcule le cout d'aliment par kg de biomasse produite.
 *
 * Formule : coutTotalAliment / gainBiomasse(kg)
 *
 * @param coutTotal - Cout total de l'aliment consomme
 * @param gainBiomasse - Gain de biomasse en kg
 * @returns Cout par kg, ou null si donnees insuffisantes
 */
export function calculerCoutParKg(
  coutTotal: number | null,
  gainBiomasse: number | null
): number | null {
  if (coutTotal == null || gainBiomasse == null || gainBiomasse <= 0) {
    return null;
  }
  return coutTotal / gainBiomasse;
}

/**
 * Calcule le retour sur investissement (ROI) en pourcentage.
 *
 * Formule : ((revenu - coutTotal) / coutTotal) × 100
 *
 * @param revenu - Revenu total de la vente
 * @param coutTotal - Cout total de production
 * @returns ROI en %, ou null si donnees insuffisantes
 */
export function calculerROI(
  revenu: number | null,
  coutTotal: number | null
): number | null {
  if (revenu == null || coutTotal == null || coutTotal <= 0) {
    return null;
  }
  return ((revenu - coutTotal) / coutTotal) * 100;
}

// ---------------------------------------------------------------------------
// Conversion d'unites d'achat (Sprint 14)
// ---------------------------------------------------------------------------

/**
 * Prix par unite de base. Si uniteAchat defini : prixUnitaire / contenance.
 *
 * Exemple : Farine de poisson a 15000 CFA/sac de 25 kg → 600 CFA/kg.
 *
 * @param p - Produit avec prixUnitaire, uniteAchat et contenance
 * @returns Prix par unite de base
 */
export function getPrixParUniteBase(p: {
  prixUnitaire: number;
  uniteAchat?: string | null;
  contenance?: number | null;
}): number {
  if (p.uniteAchat && p.contenance && p.contenance > 0) {
    return p.prixUnitaire / p.contenance;
  }
  return p.prixUnitaire;
}

/**
 * Convertit quantite achat en quantite base. quantite * contenance si applicable.
 *
 * Exemple : 2 sacs de 25 kg → 50 kg.
 *
 * @param quantite - Quantite en unite d'achat
 * @param p - Produit avec uniteAchat et contenance
 * @returns Quantite en unite de base
 */
export function convertirQuantiteAchat(
  quantite: number,
  p: { uniteAchat?: string | null; contenance?: number | null }
): number {
  if (p.uniteAchat && p.contenance && p.contenance > 0) {
    return quantite * p.contenance;
  }
  return quantite;
}

// ---------------------------------------------------------------------------
// Analytiques par aliment (CR-011)
// ---------------------------------------------------------------------------

/**
 * Calcule le FCR pondere d'un aliment a travers plusieurs vagues.
 *
 * Quand un aliment est utilise dans N vagues, on pondère le FCR
 * par la quantite consommee dans chaque vague.
 *
 * @param vagues - Tableau de { quantite, gainBiomasse } par vague
 * @returns FCR pondere, ou null si donnees insuffisantes
 */
export function calculerFCRParAliment(
  vagues: { quantite: number; gainBiomasse: number | null }[]
): number | null {
  let totalQuantite = 0;
  let totalGain = 0;

  for (const v of vagues) {
    if (v.gainBiomasse == null || v.gainBiomasse <= 0) continue;
    totalQuantite += v.quantite;
    totalGain += v.gainBiomasse;
  }

  if (totalQuantite <= 0 || totalGain <= 0) return null;
  return totalQuantite / totalGain;
}

/**
 * Calcule le cout par kg de gain pour un aliment.
 *
 * @param quantite - Quantite d'aliment consommee en kg
 * @param prixUnitaire - Prix en CFA/kg
 * @param gainBiomasse - Gain de biomasse en kg
 * @returns Cout en CFA par kg de biomasse gagnee, ou null
 */
export function calculerCoutParKgGain(
  quantite: number | null,
  prixUnitaire: number | null,
  gainBiomasse: number | null
): number | null {
  if (
    quantite == null ||
    prixUnitaire == null ||
    gainBiomasse == null ||
    quantite <= 0 ||
    gainBiomasse <= 0
  ) {
    return null;
  }
  return (quantite * prixUnitaire) / gainBiomasse;
}

/**
 * Genere une recommandation textuelle basee sur la comparaison des aliments.
 *
 * @param meilleur - Meilleur aliment (par cout/kg gain)
 * @param deuxieme - Deuxieme aliment (pour comparaison)
 * @returns Texte de recommandation en francais, ou null si donnees insuffisantes
 */
export function genererRecommandation(
  meilleur: {
    nom: string;
    fournisseur: string | null;
    fcrMoyen: number | null;
    coutParKgGain: number | null;
  } | null,
  deuxieme: {
    nom: string;
    fcrMoyen: number | null;
    coutParKgGain: number | null;
  } | null
): string | null {
  if (!meilleur || meilleur.fcrMoyen == null || meilleur.coutParKgGain == null) {
    return null;
  }

  const fournisseurStr = meilleur.fournisseur
    ? ` (fournisseur: ${meilleur.fournisseur})`
    : "";

  let texte = `L'aliment '${meilleur.nom}'${fournisseurStr} a le meilleur rapport qualite/prix avec un FCR moyen de ${meilleur.fcrMoyen.toFixed(2)} et un cout de ${Math.round(meilleur.coutParKgGain)} CFA/kg de poisson produit.`;

  if (
    deuxieme &&
    deuxieme.fcrMoyen != null &&
    deuxieme.coutParKgGain != null
  ) {
    const economie = Math.round(
      (deuxieme.coutParKgGain - meilleur.coutParKgGain) * 1000
    );
    if (economie > 0) {
      texte += ` Compare a '${deuxieme.nom}' (FCR ${deuxieme.fcrMoyen.toFixed(2)}, cout ${Math.round(deuxieme.coutParKgGain)} CFA/kg), il vous ferait economiser ${economie.toLocaleString("fr-FR")} CFA par tonne de poisson produit.`;
    }
  }

  return texte;
}
