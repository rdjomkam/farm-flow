/**
 * Fonctions de calcul des indicateurs piscicoles.
 *
 * Fonctions pures sans dependance DB — utilisees par les API routes
 * et les composants pour calculer les indicateurs d'une vague.
 *
 * Phase 3 (Sprint 19) : Ajout des fonctions configurables via ConfigElevage.
 * - detecterPhase(poidsMoyen, config?) → PhaseElevage
 * - getTauxAlimentation(poidsMoyen, config?) → number
 * - getTailleAliment(poidsMoyen, config?) → string
 * - convertirUniteStock(quantite, uniteSource, uniteDestination) → number
 */

import type { ConfigElevage, AlimentTailleEntree, AlimentTauxEntree } from "@/types";
import { PhaseElevage } from "@/types";

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
// Vivants par bac (shared between indicateurs.ts and page.tsx chart)
// ---------------------------------------------------------------------------

/**
 * Calcule le nombre de vivants par bac a partir des releves.
 *
 * Pour chaque bac :
 *   vivants = dernierComptage ?? (nombreInitialBac - totalMortsBac)
 *   nombreInitialBac = bac.nombreInitial ?? Math.round(nombreInitialVague / totalBacs)
 *
 * @returns Map<bacId, vivants>
 */
export function computeVivantsByBac(
  bacs: { id: string; nombreInitial: number | null }[],
  releves: { bacId: string | null; typeReleve: string; nombreMorts: number | null; nombreCompte: number | null }[],
  nombreInitialVague: number
): Map<string, number> {
  const nombreInitialParBac = bacs.length > 0
    ? Math.round(nombreInitialVague / bacs.length)
    : nombreInitialVague;

  // Group mortalites by bacId
  const mortsParBac = new Map<string, number>();
  for (const r of releves) {
    if (r.typeReleve === "MORTALITE" && r.bacId) {
      mortsParBac.set(r.bacId, (mortsParBac.get(r.bacId) ?? 0) + (r.nombreMorts ?? 0));
    }
  }

  // Group comptages by bacId, keep last (assumes releves sorted by date asc)
  const comptagesParBac = new Map<string, number>();
  for (const r of releves) {
    if (r.typeReleve === "COMPTAGE" && r.bacId && r.nombreCompte !== null) {
      comptagesParBac.set(r.bacId, r.nombreCompte);
    }
  }

  const result = new Map<string, number>();
  for (const bac of bacs) {
    const initialBac = bac.nombreInitial ?? nombreInitialParBac;
    const mortsBac = mortsParBac.get(bac.id) ?? 0;
    const comptage = comptagesParBac.get(bac.id);
    result.set(bac.id, comptage ?? (initialBac - mortsBac));
  }

  return result;
}

/**
 * Calcule le nombre total de poissons vivants pour une vague
 * en agregeant par bac via computeVivantsByBac().
 * Remplace le pattern faux `comptages.at(-1)?.nombreCompte`.
 */
export function computeNombreVivantsVague(
  bacs: { id: string; nombreInitial: number | null }[],
  releves: { bacId: string | null; typeReleve: string; nombreMorts: number | null; nombreCompte: number | null }[],
  nombreInitialVague: number
): number {
  if (bacs.length === 0) {
    // Fallback: no bacs attached, use global logic
    const comptages = releves.filter(r => r.typeReleve === "COMPTAGE" && r.nombreCompte !== null);
    if (comptages.length > 0) return comptages.at(-1)!.nombreCompte!;
    const totalMorts = releves
      .filter(r => r.typeReleve === "MORTALITE")
      .reduce((sum, r) => sum + (r.nombreMorts ?? 0), 0);
    return nombreInitialVague - totalMorts;
  }
  const vivantsByBac = computeVivantsByBac(bacs, releves, nombreInitialVague);
  let total = 0;
  for (const v of vivantsByBac.values()) total += v;
  return total;
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

// ---------------------------------------------------------------------------
// Phase 3 (Sprint 19) — Fonctions configurables via ConfigElevage
// ---------------------------------------------------------------------------

/** Seuils de phases par defaut (fallback EC-5.1) */
const DEFAULT_SEUILS = {
  acclimatation: 15,
  croissanceDebut: 50,
  juvenile: 150,
  grossissement: 350,
  finition: 700,
};

/** Table de taux d'alimentation par defaut (%BW/jour, moyenne) */
const DEFAULT_TAUX_ALIMENTATION: Record<string, { tauxMin: number; tauxMax: number }> = {
  ACCLIMATATION: { tauxMin: 8, tauxMax: 10 },
  CROISSANCE_DEBUT: { tauxMin: 5, tauxMax: 6 },
  JUVENILE: { tauxMin: 3, tauxMax: 5 },
  GROSSISSEMENT: { tauxMin: 2, tauxMax: 3 },
  FINITION: { tauxMin: 1.5, tauxMax: 2 },
  PRE_RECOLTE: { tauxMin: 1, tauxMax: 1.5 },
};

/** Table de taille d'aliment par defaut */
const DEFAULT_TAILLE_ALIMENT: AlimentTailleEntree[] = [
  { poidsMin: 0, poidsMax: 15, tailleGranule: "1.2mm", description: "Aliment demarrage" },
  { poidsMin: 15, poidsMax: 30, tailleGranule: "1.5-2mm", description: "Aliment croissance petit" },
  { poidsMin: 30, poidsMax: 80, tailleGranule: "2-3mm", description: "Aliment croissance" },
  { poidsMin: 80, poidsMax: 150, tailleGranule: "3-4mm", description: "Aliment grossissement petit" },
  { poidsMin: 150, poidsMax: 350, tailleGranule: "4-6mm", description: "Aliment grossissement" },
  { poidsMin: 350, poidsMax: 99999, tailleGranule: "6-9mm", description: "Aliment finition" },
];

/**
 * Detecte la phase de croissance en fonction du poids moyen.
 *
 * Utilise les seuils du ConfigElevage si fourni, sinon les valeurs hardcodees (EC-5.1).
 *
 * @param poidsMoyen - Poids moyen du poisson en grammes
 * @param config - ConfigElevage optionnel (fallback si absent)
 * @returns Phase de croissance courante
 */
export function detecterPhase(
  poidsMoyen: number | null,
  config?: ConfigElevage | null
): PhaseElevage {
  if (poidsMoyen == null || poidsMoyen < 0) return PhaseElevage.ACCLIMATATION;

  const seuils = config ?? DEFAULT_SEUILS;
  const acclimatation = "seuilAcclimatation" in seuils ? seuils.seuilAcclimatation : DEFAULT_SEUILS.acclimatation;
  const croissanceDebut = "seuilCroissanceDebut" in seuils ? seuils.seuilCroissanceDebut : DEFAULT_SEUILS.croissanceDebut;
  const juvenile = "seuilJuvenile" in seuils ? seuils.seuilJuvenile : DEFAULT_SEUILS.juvenile;
  const grossissement = "seuilGrossissement" in seuils ? seuils.seuilGrossissement : DEFAULT_SEUILS.grossissement;
  const finition = "seuilFinition" in seuils ? seuils.seuilFinition : DEFAULT_SEUILS.finition;

  if (poidsMoyen <= acclimatation) return PhaseElevage.ACCLIMATATION;
  if (poidsMoyen <= croissanceDebut) return PhaseElevage.CROISSANCE_DEBUT;
  if (poidsMoyen <= juvenile) return PhaseElevage.JUVENILE;
  if (poidsMoyen <= grossissement) return PhaseElevage.GROSSISSEMENT;
  if (poidsMoyen <= finition) return PhaseElevage.FINITION;
  return PhaseElevage.PRE_RECOLTE;
}

/**
 * Retourne le taux d'alimentation recommande (%BW/jour) pour un poids moyen donne.
 *
 * Retourne la moyenne de tauxMin et tauxMax de la phase correspondante.
 * Utilise alimentTauxConfig du ConfigElevage si fourni, sinon les valeurs hardcodees.
 *
 * @param poidsMoyen - Poids moyen du poisson en grammes
 * @param config - ConfigElevage optionnel (fallback si absent)
 * @returns Taux d'alimentation en % du poids vif par jour (ex: 5 = 5%)
 */
export function getTauxAlimentation(
  poidsMoyen: number | null,
  config?: ConfigElevage | null
): number {
  const phase = detecterPhase(poidsMoyen, config);

  if (config?.alimentTauxConfig) {
    const tauxConfig = (config.alimentTauxConfig as AlimentTauxEntree[]).find(
      (t) => t.phase === phase
    );
    if (tauxConfig) {
      return (tauxConfig.tauxMin + tauxConfig.tauxMax) / 2;
    }
  }

  const defaultTaux = DEFAULT_TAUX_ALIMENTATION[phase];
  if (defaultTaux) {
    return (defaultTaux.tauxMin + defaultTaux.tauxMax) / 2;
  }

  return 3; // Fallback ultime
}

/**
 * Retourne la taille de granule recommandee pour un poids moyen donne.
 *
 * Utilise alimentTailleConfig du ConfigElevage si fourni, sinon les valeurs hardcodees.
 *
 * @param poidsMoyen - Poids moyen du poisson en grammes
 * @param config - ConfigElevage optionnel (fallback si absent)
 * @returns Taille du granule en string — ex: "2-3mm"
 */
export function getTailleAliment(
  poidsMoyen: number | null,
  config?: ConfigElevage | null
): string {
  if (poidsMoyen == null || poidsMoyen < 0) return "1.2mm";

  const tailleConfig: AlimentTailleEntree[] = config?.alimentTailleConfig
    ? (config.alimentTailleConfig as AlimentTailleEntree[])
    : DEFAULT_TAILLE_ALIMENT;

  const match = tailleConfig.find(
    (a) => poidsMoyen >= a.poidsMin && poidsMoyen < a.poidsMax
  );

  return match?.tailleGranule ?? "6-9mm";
}

// ---------------------------------------------------------------------------
// Sprint 22 (S16-5) — Fonctions de projection de performance
// ---------------------------------------------------------------------------

/**
 * Calcule le SGR requis pour atteindre l'objectif de poids dans les jours restants.
 *
 * Formule : (ln(poidsObjectif) - ln(poidsMoyenActuel)) / joursRestants * 100
 *
 * @param poidsMoyenActuel - Poids moyen actuel en grammes
 * @param poidsObjectif - Poids objectif en grammes
 * @param joursRestants - Nombre de jours restants avant la recolte
 * @returns SGR requis en %/jour, ou null si les donnees sont insuffisantes
 */
export function calculerSGRRequis(
  poidsMoyenActuel: number | null,
  poidsObjectif: number | null,
  joursRestants: number | null
): number | null {
  if (
    poidsMoyenActuel == null ||
    poidsObjectif == null ||
    joursRestants == null ||
    poidsMoyenActuel <= 0 ||
    poidsObjectif <= 0 ||
    joursRestants <= 0
  ) {
    return null;
  }
  return (
    ((Math.log(poidsObjectif) - Math.log(poidsMoyenActuel)) / joursRestants) *
    100
  );
}

/**
 * Calcule la date de recolte estimee en fonction du SGR actuel.
 *
 * Si le SGR actuel est nul ou insuffisant, retourne null.
 *
 * Formule : joursNecessaires = (ln(poidsObjectif) - ln(poidsMoyenActuel)) / (sgrActuel / 100)
 *
 * @param poidsMoyenActuel - Poids moyen actuel en grammes
 * @param poidsObjectif - Poids objectif en grammes
 * @param sgrActuel - SGR actuel en %/jour
 * @param dateReference - Date de reference pour le calcul (par defaut aujourd'hui)
 * @returns Date estimee de recolte, ou null si les donnees sont insuffisantes
 */
export function calculerDateRecolteEstimee(
  poidsMoyenActuel: number | null,
  poidsObjectif: number | null,
  sgrActuel: number | null,
  dateReference?: Date
): Date | null {
  if (
    poidsMoyenActuel == null ||
    poidsObjectif == null ||
    sgrActuel == null ||
    poidsMoyenActuel <= 0 ||
    poidsObjectif <= 0 ||
    sgrActuel <= 0
  ) {
    return null;
  }
  const joursNecessaires =
    (Math.log(poidsObjectif) - Math.log(poidsMoyenActuel)) / (sgrActuel / 100);
  if (!isFinite(joursNecessaires) || joursNecessaires <= 0) return null;

  const base = dateReference ?? new Date();
  const dateRecolte = new Date(base);
  dateRecolte.setDate(dateRecolte.getDate() + Math.round(joursNecessaires));
  return dateRecolte;
}

/**
 * Estime la quantite d'aliment restante necessaire jusqu'a la recolte.
 *
 * Formule simplifiee :
 *   gainBiomasseRestant = (poidsObjectif - poidsMoyenActuel) * nombreVivants / 1000
 *   alimentRestant = gainBiomasseRestant * fcrActuel
 *
 * @param poidsMoyenActuel - Poids moyen actuel en grammes
 * @param poidsObjectif - Poids objectif en grammes
 * @param nombreVivants - Nombre de poissons vivants estime
 * @param fcrActuel - FCR actuel (ou FCR cible si actuel non disponible)
 * @returns Quantite d'aliment restant estimee en kg, ou null
 */
export function calculerAlimentRestantEstime(
  poidsMoyenActuel: number | null,
  poidsObjectif: number | null,
  nombreVivants: number | null,
  fcrActuel: number | null
): number | null {
  if (
    poidsMoyenActuel == null ||
    poidsObjectif == null ||
    nombreVivants == null ||
    fcrActuel == null ||
    poidsMoyenActuel <= 0 ||
    poidsObjectif <= poidsMoyenActuel ||
    nombreVivants <= 0 ||
    fcrActuel <= 0
  ) {
    return null;
  }
  const gainBiomasseRestant =
    ((poidsObjectif - poidsMoyenActuel) * nombreVivants) / 1000;
  return gainBiomasseRestant * fcrActuel;
}

/**
 * Estime le revenu attendu a la recolte.
 *
 * Formule : biomasseFinalePrevue(kg) * prixVenteKg * (tauxSurvie / 100)
 *   ou biomasseFinalePrevue = poidsObjectif * nombreInitial / 1000
 *
 * @param poidsObjectif - Poids objectif en grammes
 * @param nombreVivants - Nombre de poissons vivants estime
 * @param prixVenteKg - Prix de vente en CFA/kg
 * @returns Revenu estime en CFA, ou null si les donnees sont insuffisantes
 */
export function calculerRevenuAttendu(
  poidsObjectif: number | null,
  nombreVivants: number | null,
  prixVenteKg: number | null
): number | null {
  if (
    poidsObjectif == null ||
    nombreVivants == null ||
    prixVenteKg == null ||
    poidsObjectif <= 0 ||
    nombreVivants <= 0 ||
    prixVenteKg <= 0
  ) {
    return null;
  }
  const biomasseFinalePrevue = (poidsObjectif * nombreVivants) / 1000;
  return biomasseFinalePrevue * prixVenteKg;
}

/**
 * Genere les points de courbe de croissance projetee pour un graphique Recharts.
 *
 * Projette le poids moyen jour par jour en utilisant le SGR actuel
 * depuis la date actuelle jusqu'a la date recolte.
 *
 * @param poidsMoyenActuel - Poids moyen actuel en grammes
 * @param sgrActuel - SGR actuel en %/jour
 * @param joursProjection - Nombre de jours a projeter
 * @param jourDepart - Numero du jour de depart (par rapport au debut de la vague)
 * @returns Tableau de points { jour, poidsMoyen } pour Recharts
 */
export function genererCourbeProjection(
  poidsMoyenActuel: number | null,
  sgrActuel: number | null,
  joursProjection: number,
  jourDepart: number = 0
): { jour: number; poidsProjecte: number }[] {
  if (
    poidsMoyenActuel == null ||
    sgrActuel == null ||
    poidsMoyenActuel <= 0 ||
    sgrActuel <= 0 ||
    joursProjection <= 0
  ) {
    return [];
  }

  const points: { jour: number; poidsProjecte: number }[] = [];
  const sgr = sgrActuel / 100;

  for (let i = 0; i <= joursProjection; i++) {
    const poidsProjecte = poidsMoyenActuel * Math.exp(sgr * i);
    points.push({
      jour: jourDepart + i,
      poidsProjecte: Math.round(poidsProjecte),
    });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Sprint 27-28 (ADR-density-alerts) — Calcul de densite par bac
// ---------------------------------------------------------------------------

/**
 * Calcule la densite de biomasse pour un bac specifique en kg/m3.
 *
 * Algorithme :
 *   1. Recuperer les vivants du bac via computeVivantsByBac()
 *   2. Trouver la derniere biometrie filtree par bacId (per-bac)
 *   3. Fallback vers la derniere biometrie globale (bacId == null) si aucune per-bac
 *   4. densiteKgM3 = (poidsMoyenBac * vivantsBac / 1000) / (volume / 1000)
 *
 * @param bac                 - Bac dont on veut la densite
 * @param bacs                - Tous les bacs de la vague (pour computeVivantsByBac)
 * @param releves             - Tous les releves de la vague (tous types)
 * @param nombreInitialVague  - Nombre initial de poissons pour la vague
 * @returns Densite en kg/m3, ou null si donnees insuffisantes
 */
export function calculerDensiteBac(
  bac: { id: string; volume: number | null; nombreInitial: number | null },
  bacs: { id: string; nombreInitial: number | null }[],
  releves: {
    bacId: string | null;
    typeReleve: string;
    nombreMorts: number | null;
    nombreCompte: number | null;
    poidsMoyen: number | null;
    date: Date;
  }[],
  nombreInitialVague: number
): number | null {
  if (bac.volume == null || bac.volume <= 0) return null;

  // 1. Obtenir le nombre de vivants pour CE bac
  const vivantsByBac = computeVivantsByBac(bacs, releves, nombreInitialVague);
  const vivantsBac = vivantsByBac.get(bac.id) ?? 0;
  if (vivantsBac <= 0) return null;

  // 2. Trouver la derniere biometrie per-bac (triees par date croissante → derniere = la plus recente)
  const biometriesParBac = releves
    .filter((r) => r.typeReleve === "BIOMETRIE" && r.bacId === bac.id && r.poidsMoyen != null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const derniereBiometrieParBac = biometriesParBac.at(-1) ?? null;

  // 3. Fallback vers la derniere biometrie globale (bacId == null)
  const biometriesGlobales = releves
    .filter((r) => r.typeReleve === "BIOMETRIE" && r.bacId == null && r.poidsMoyen != null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const derniereBiometrieGlobale = biometriesGlobales.at(-1) ?? null;

  const poidsMoyenBac =
    derniereBiometrieParBac?.poidsMoyen ??
    derniereBiometrieGlobale?.poidsMoyen ??
    null;

  if (poidsMoyenBac == null) return null;

  // 4. Calculer la densite : biomasse (kg) / volume (m3)
  const biomasseBacKg = (poidsMoyenBac * vivantsBac) / 1000;
  const volumeM3 = bac.volume / 1000;
  return biomasseBacKg / volumeM3;
}

/**
 * Calcule la densite de biomasse agregee d'une vague (somme des biomasses / somme des volumes).
 *
 * Utilisee pour l'affichage sur le dashboard uniquement.
 * Pour les alertes per-bac, utiliser calculerDensiteBac().
 *
 * @param bacs    - Tous les bacs de la vague avec volume
 * @param releves - Tous les releves de la vague
 * @param nombreInitialVague - Nombre initial de poissons pour la vague
 * @returns Densite agregee en kg/m3, ou null si donnees insuffisantes
 */
export function calculerDensiteVague(
  bacs: { id: string; volume: number | null; nombreInitial: number | null }[],
  releves: {
    bacId: string | null;
    typeReleve: string;
    nombreMorts: number | null;
    nombreCompte: number | null;
    poidsMoyen: number | null;
    date: Date;
  }[],
  nombreInitialVague: number
): number | null {
  if (bacs.length === 0) return null;

  const vivantsByBac = computeVivantsByBac(bacs, releves, nombreInitialVague);

  let totalBiomasseKg = 0;
  let totalVolumeM3 = 0;

  for (const bac of bacs) {
    if (bac.volume == null || bac.volume <= 0) continue;

    const vivantsBac = vivantsByBac.get(bac.id) ?? 0;
    if (vivantsBac <= 0) continue;

    // Derniere biometrie per-bac puis globale en fallback
    const biometriesParBac = releves
      .filter((r) => r.typeReleve === "BIOMETRIE" && r.bacId === bac.id && r.poidsMoyen != null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const biometriesGlobales = releves
      .filter((r) => r.typeReleve === "BIOMETRIE" && r.bacId == null && r.poidsMoyen != null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const poidsMoyen =
      biometriesParBac.at(-1)?.poidsMoyen ??
      biometriesGlobales.at(-1)?.poidsMoyen ??
      null;

    if (poidsMoyen == null) continue;

    totalBiomasseKg += (poidsMoyen * vivantsBac) / 1000;
    totalVolumeM3 += bac.volume / 1000;
  }

  if (totalVolumeM3 <= 0) return null;
  return totalBiomasseKg / totalVolumeM3;
}

/**
 * Calcule le taux de renouvellement d'eau effectif en %/jour.
 *
 * Aggrege les releves RENOUVELLEMENT sur une fenetre glissante et calcule
 * la moyenne quotidienne.
 *
 * @param relevesRenouvellement - Releves de type RENOUVELLEMENT (tous bacId confondus ou filtres)
 * @param bacVolumeLitres       - Volume du bac en litres (pour convertir volumeRenouvele → %)
 * @param periodeDays           - Fenetre en jours (defaut: 7)
 * @returns Taux moyen en %/jour, ou null si aucun releve dans la fenetre
 */
export function computeTauxRenouvellement(
  relevesRenouvellement: {
    date: Date;
    pourcentageRenouvellement: number | null;
    volumeRenouvele: number | null;
    nombreRenouvellements: number | null;
  }[],
  bacVolumeLitres: number | null,
  periodeDays: number = 7
): number | null {
  const now = Date.now();
  const cutoff = now - periodeDays * 24 * 60 * 60 * 1000;

  // Filtrer les releves dans la fenetre
  const relevesDansFenetre = relevesRenouvellement.filter(
    (r) => new Date(r.date).getTime() >= cutoff
  );

  if (relevesDansFenetre.length === 0) return null;

  let totalPct = 0;
  let count = 0;

  for (const r of relevesDansFenetre) {
    const passages = r.nombreRenouvellements ?? 1;
    if (r.pourcentageRenouvellement != null) {
      totalPct += r.pourcentageRenouvellement * passages;
      count++;
    } else if (r.volumeRenouvele != null && bacVolumeLitres != null && bacVolumeLitres > 0) {
      // Convertir volume en pourcentage
      const pct = (r.volumeRenouvele / bacVolumeLitres) * 100;
      totalPct += pct * passages;
      count++;
    }
    // Si ni pourcentage ni volume convertible → ignorer
  }

  if (count === 0) return null;

  // Taux moyen sur la periode = somme des % / nombre de jours (pas de releves)
  // Formule : sum(percentages) / periodeDays → %/jour
  return totalPct / periodeDays;
}

/**
 * Convertit une quantite entre unites de stock.
 *
 * Conversions supportees (adresse EC-14.4) :
 * - KG ↔ grammes : 1 KG = 1000 grammes
 * - SACS → KG : depende de la contenance (parametre optionnel, defaut 25 kg/sac)
 * - SACS → grammes : conversion via KG
 * - Meme unite → retourne quantite inchangee
 *
 * @param quantite - Quantite a convertir
 * @param uniteSource - Unite de depart (UniteStock ou string)
 * @param uniteDestination - Unite cible (UniteStock ou string)
 * @param contenanceSac - Poids d'un sac en kg (uniquement pour SACS, defaut 25)
 * @returns Quantite convertie, ou null si conversion impossible
 */
export function convertirUniteStock(
  quantite: number | null,
  uniteSource: string,
  uniteDestination: string,
  contenanceSac: number = 25
): number | null {
  if (quantite == null) return null;
  if (uniteSource === uniteDestination) return quantite;

  // Normaliser: tout convertir en grammes d'abord
  let quantiteEnGrammes: number | null = null;

  switch (uniteSource.toUpperCase()) {
    case "GRAMME":
      quantiteEnGrammes = quantite;
      break;
    case "KG":
      quantiteEnGrammes = quantite * 1000;
      break;
    case "SACS":
      quantiteEnGrammes = quantite * contenanceSac * 1000;
      break;
    case "MILLILITRE":
      quantiteEnGrammes = quantite; // Approximation : 1ml ≈ 1g pour les liquides
      break;
    case "LITRE":
      quantiteEnGrammes = quantite * 1000;
      break;
    case "UNITE":
      return null; // Unite incompatible avec les conversions ponderales
    default:
      return null;
  }

  if (quantiteEnGrammes == null) return null;

  // Convertir depuis grammes vers la destination
  switch (uniteDestination.toUpperCase()) {
    case "GRAMME":
      return quantiteEnGrammes;
    case "KG":
      return quantiteEnGrammes / 1000;
    case "SACS":
      return quantiteEnGrammes / (contenanceSac * 1000);
    case "MILLILITRE":
      return quantiteEnGrammes;
    case "LITRE":
      return quantiteEnGrammes / 1000;
    default:
      return null;
  }
}
