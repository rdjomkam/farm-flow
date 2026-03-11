/**
 * Types pour les indicateurs de performance piscicole.
 *
 * Ces indicateurs sont calcules a partir des releves d'une vague.
 * Les fonctions de calcul correspondantes sont dans src/lib/calculs.ts.
 */

import { StatutVague } from "./models";

// ---------------------------------------------------------------------------
// Indicateurs principaux
// ---------------------------------------------------------------------------

/**
 * Indicateurs de performance d'une vague.
 *
 * Calcules a partir des releves (biometrie, mortalite, alimentation, comptage).
 * Null quand les donnees sont insuffisantes pour le calcul.
 */
export interface IndicateursVague {
  /**
   * Taux de survie en pourcentage.
   * Formule : (nombreVivants / nombreInitial) * 100
   */
  tauxSurvie: number | null;

  /**
   * FCR (Feed Conversion Ratio) — indice de conversion alimentaire.
   * Formule : totalAlimentConsomme / gainBiomasse
   * Valeur ideale pour silures : 1.0 - 1.5
   */
  fcr: number | null;

  /**
   * SGR (Specific Growth Rate) — taux de croissance specifique en %/jour.
   * Formule : ((ln(poidsFinal) - ln(poidsInitial)) / nombreJours) * 100
   */
  sgr: number | null;

  /**
   * Biomasse totale actuelle en kg.
   * Formule : poidsMoyen * nombreVivants / 1000
   */
  biomasse: number | null;

  /**
   * Poids moyen actuel en grammes.
   * Issu du dernier releve biometrique.
   */
  poidsMoyen: number | null;

  /**
   * Taille moyenne actuelle en cm.
   * Issue du dernier releve biometrique.
   */
  tailleMoyenne: number | null;

  /**
   * Nombre de poissons vivants estime.
   * Issu du dernier comptage ou calcule a partir des mortalites.
   */
  nombreVivants: number | null;

  /**
   * Total des mortalites enregistrees.
   */
  totalMortalites: number;

  /**
   * Quantite totale d'aliment distribue en kg.
   */
  totalAliment: number;

  /**
   * Gain de poids moyen depuis le debut en grammes.
   * Formule : poidsMoyenActuel - poidsMoyenInitial
   */
  gainPoids: number | null;

  /**
   * Nombre de jours ecoules depuis le debut de la vague.
   */
  joursEcoules: number;
}

// ---------------------------------------------------------------------------
// Bilan de vague
// ---------------------------------------------------------------------------

/**
 * Bilan complet d'une vague — utilise pour l'affichage du detail
 * et les exports/rapports.
 */
export interface BilanVague {
  /** Code de la vague */
  vagueCode: string;
  /** Indicateurs calcules */
  indicateurs: IndicateursVague;
  /** Date de debut */
  dateDebut: Date;
  /** Date de fin (null si en cours) */
  dateFin: Date | null;
  /** Nombre initial d'alevins */
  nombreInitial: number;
  /** Poids moyen initial en grammes */
  poidsMoyenInitial: number;
  /** Nombre de bacs utilises */
  nombreBacs: number;
  /** Nombre total de releves enregistres */
  nombreReleves: number;
}

// ---------------------------------------------------------------------------
// Donnees pour les graphiques (Recharts)
// ---------------------------------------------------------------------------

/**
 * Point de donnee pour l'evolution du poids moyen dans le temps.
 * Utilise par Recharts LineChart.
 */
export interface EvolutionPoidsPoint {
  /** Date du releve (ISO string pour Recharts) */
  date: string;
  /** Poids moyen en grammes */
  poidsMoyen: number;
  /** Jour depuis le debut de la vague (J0, J1, ...) */
  jour: number;
}

/**
 * Point de donnee pour l'evolution de la mortalite cumulee.
 */
export interface EvolutionMortalitePoint {
  /** Date du releve */
  date: string;
  /** Mortalite cumulee */
  mortaliteCumulee: number;
  /** Taux de survie a cette date en % */
  tauxSurvie: number;
}

/**
 * Point de donnee pour l'alimentation quotidienne.
 */
export interface AlimentationPoint {
  /** Date */
  date: string;
  /** Quantite en kg */
  quantite: number;
  /** Type d'aliment */
  typeAliment: string;
}

/**
 * Donnees pour le dashboard — resume de toutes les vagues actives.
 */
export interface DashboardData {
  /** Nombre de vagues en cours */
  vaguesActives: number;
  /** Biomasse totale de toutes les vagues en kg */
  biomasseTotale: number | null;
  /** Taux de survie moyen en % */
  tauxSurvieMoyen: number | null;
  /** Nombre total de bacs occupes */
  bacsOccupes: number;
  /** Nombre total de bacs */
  bacsTotal: number;
  /** Resume par vague active */
  vagues: VagueDashboardSummary[];
}

/**
 * Resume d'une vague pour le dashboard.
 */
export interface VagueDashboardSummary {
  id: string;
  code: string;
  joursEcoules: number;
  poidsMoyen: number | null;
  tauxSurvie: number | null;
  biomasse: number | null;
  nombreBacs: number;
  statut: StatutVague;
}

// ---------------------------------------------------------------------------
// Analytiques par bac (CR-010)
// ---------------------------------------------------------------------------

/**
 * Indicateurs de performance d'un bac individuel.
 *
 * Calcules a partir des releves filtres par bacId au sein d'une vague.
 */
export interface IndicateursBac {
  bacId: string;
  bacNom: string;
  vagueId: string;
  /** Volume du bac en litres */
  volume: number;
  // Tier 1 — metriques essentielles
  /** Taux de survie en % */
  tauxSurvie: number | null;
  /** FCR — indice de conversion alimentaire */
  fcr: number | null;
  /** SGR — taux de croissance specifique en %/jour */
  sgr: number | null;
  /** Biomasse totale en kg */
  biomasse: number | null;
  /** Poids moyen actuel en grammes */
  poidsMoyen: number | null;
  /** Densite de biomasse en kg/m³ */
  densite: number | null;
  /** Taux de mortalite en % */
  tauxMortalite: number | null;
  /** Gain de biomasse quotidien en kg/jour */
  gainQuotidien: number | null;
  // Aggregats bruts
  /** Nombre de poissons vivants estime */
  nombreVivants: number | null;
  /** Total mortalites enregistrees */
  totalMortalites: number;
  /** Total aliment distribue en kg */
  totalAliment: number;
  // Metadata
  /** Date du dernier releve */
  dernierReleve: Date | null;
  /** Nombre total de releves */
  nombreReleves: number;
}

/**
 * Comparaison des indicateurs de tous les bacs d'une vague.
 */
export interface ComparaisonBacs {
  vagueId: string;
  vagueCode: string;
  bacs: IndicateursBac[];
  /** bacId du meilleur FCR (le plus bas) */
  meilleurFCR: string | null;
  /** bacId du meilleur taux de survie (le plus haut) */
  meilleurSurvie: string | null;
  /** Alertes generees sur les bacs */
  alertes: AlerteBac[];
}

/**
 * Alerte generee quand un indicateur de bac depasse un seuil critique.
 */
export interface AlerteBac {
  bacId: string;
  bacNom: string;
  type: "SURVIE_BASSE" | "FCR_ELEVE" | "MORTALITE_HAUTE" | "DENSITE_ELEVEE";
  /** Message descriptif en francais */
  message: string;
  /** Valeur actuelle de l'indicateur */
  valeur: number;
  /** Seuil depasse */
  seuil: number;
}

/**
 * Performance historique d'un bac a travers les differentes vagues.
 */
export interface HistoriqueBac {
  bacId: string;
  bacNom: string;
  volume: number;
  cycles: HistoriqueBacCycle[];
}

/**
 * Performance d'un bac pour un cycle (vague) donne.
 */
export interface HistoriqueBacCycle {
  vagueId: string;
  vagueCode: string;
  dateDebut: Date;
  dateFin: Date | null;
  tauxSurvie: number | null;
  fcr: number | null;
  sgr: number | null;
  biomasse: number | null;
  poidsMoyen: number | null;
  gainQuotidien: number | null;
  nombreReleves: number;
}

// ---------------------------------------------------------------------------
// Analytiques par aliment (CR-011)
// ---------------------------------------------------------------------------

/**
 * Metriques agregees d'un aliment (produit de categorie ALIMENT).
 *
 * Calculees en croisant ReleveConsommation, Releve (biometrie/mortalite)
 * et Produit pour obtenir le FCR, cout/kg de gain, etc.
 */
export interface AnalytiqueAliment {
  produitId: string;
  produitNom: string;
  fournisseurNom: string | null;
  /** Toujours ALIMENT */
  categorie: string;
  /** Prix unitaire en CFA/kg */
  prixUnitaire: number;
  /** Quantite totale consommee en kg */
  quantiteTotale: number;
  /** Cout total depense en CFA */
  coutTotal: number;
  /** Nombre de vagues ou cet aliment est utilise */
  nombreVagues: number;
  /** FCR moyen pondere par quantite */
  fcrMoyen: number | null;
  /** SGR moyen pondere */
  sgrMoyen: number | null;
  /** Cout en CFA par kg de biomasse gagnee */
  coutParKgGain: number | null;
  /** Taux de survie moyen pendant utilisation */
  tauxSurvieAssocie: number | null;
}

/**
 * Comparaison de tous les aliments utilises sur un site.
 */
export interface ComparaisonAliments {
  siteId: string;
  aliments: AnalytiqueAliment[];
  /** produitId du meilleur FCR (le plus bas) */
  meilleurFCR: string | null;
  /** produitId du meilleur cout par kg de gain (le plus bas) */
  meilleurCoutKg: string | null;
  /** produitId du meilleur SGR (le plus haut) */
  meilleurSGR: string | null;
  /** Recommandation textuelle auto-generee */
  recommandation: string | null;
}

/**
 * Detail d'un aliment avec ventilation par vague et evolution FCR.
 */
export interface DetailAliment extends AnalytiqueAliment {
  /** Performance par vague */
  parVague: DetailAlimentVague[];
  /** Evolution du FCR dans le temps (pour graphique tendance) */
  evolutionFCR: { date: string; fcr: number }[];
}

/**
 * Performance d'un aliment pour une vague specifique.
 */
export interface DetailAlimentVague {
  vagueId: string;
  vagueCode: string;
  quantite: number;
  fcr: number | null;
  sgr: number | null;
  coutParKgGain: number | null;
  periode: { debut: Date; fin: Date | null };
}

/**
 * Resultat d'une simulation de changement d'aliment.
 */
export interface SimulationResult {
  ancienProduitId: string;
  ancienProduitNom: string;
  nouveauProduitId: string;
  nouveauProduitNom: string;
  productionCible: number;
  /** FCR de l'ancien aliment */
  ancienFCR: number | null;
  /** FCR du nouvel aliment */
  nouveauFCR: number | null;
  /** Cout ancien aliment pour la production cible */
  ancienCout: number | null;
  /** Cout nouveau aliment pour la production cible */
  nouveauCout: number | null;
  /** Economie projetee (positif = economie, negatif = surcout) */
  economie: number | null;
  /** Message descriptif */
  message: string;
}

// ---------------------------------------------------------------------------
// Analytics dashboard (CR-012)
// ---------------------------------------------------------------------------

/**
 * Point de donnee pour l'evolution du FCR mensuel.
 *
 * Utilise par Recharts LineChart dans le dashboard analytique.
 */
export interface TendanceFCRPoint {
  /** Mois au format ISO "YYYY-MM" (ex. "2026-01") */
  mois: string;
  /** FCR moyen sur ce mois */
  fcr: number;
}

/**
 * Donnees consolidees pour le dashboard analytique.
 *
 * Aggrege les meilleurs indicateurs de performance du site
 * (meilleur bac, meilleur aliment, alertes, tendance FCR, stats globales).
 */
export interface AnalyticsDashboard {
  /**
   * Bac ayant le meilleur FCR parmi toutes les vagues actives.
   * Null si aucun bac n'a de donnees suffisantes.
   */
  meilleurBac: {
    id: string;
    nom: string;
    fcr: number;
    tauxSurvie: number;
  } | null;

  /**
   * Aliment ayant le meilleur cout par kg de gain parmi les vagues actives.
   * Null si aucun aliment n'a de donnees suffisantes.
   */
  meilleurAliment: {
    nom: string;
    coutParKgGain: number;
  } | null;

  /**
   * Nombre total d'alertes de performance actives (FCR eleve, survie basse, etc.).
   */
  alertesPerformance: number;

  /**
   * Serie temporelle du FCR moyen mensuel — pour graphique de tendance.
   */
  tendanceFCR: TendanceFCRPoint[];

  /**
   * Statistiques globales du site.
   */
  stats: {
    /** Nombre de vagues avec statut EN_COURS */
    vaguesEnCours: number;
    /** Nombre de bacs actuellement assigne a une vague */
    bacsActifs: number;
    /** Nombre total de reproducteurs actifs */
    totalReproducteurs: number;
    /** Nombre total de lots d'alevins en elevage */
    totalLotsEnElevage: number;
  };
}

// ---------------------------------------------------------------------------
// Comparaison entre vagues (CR-012)
// ---------------------------------------------------------------------------

/**
 * Indicateurs complets d'une vague pour la comparaison inter-vagues.
 *
 * Combine les metriques zootechniques et financieres d'une vague terminee
 * ou en cours, permettant un classement et une analyse comparative.
 */
export interface IndicateursVagueComplet {
  id: string;
  nom: string;
  code: string;
  statut: string;
  dateDebut: Date;
  /** Null si la vague est encore en cours */
  dateFin: Date | null;
  /** Duree effective en jours (jours ecoules si en cours) */
  dureeJours: number;
  /** Nombre d'alevins places au depart */
  nombreInitial: number;

  // Indicateurs zootechniques
  /** FCR global sur l'ensemble de la vague — null si donnees insuffisantes */
  fcrGlobal: number | null;
  /** Taux de survie final en % — null si donnees insuffisantes */
  tauxSurvie: number | null;
  /** SGR moyen en %/jour — null si donnees insuffisantes */
  sgrMoyen: number | null;
  /** Biomasse produite (gain net) en kg — null si donnees insuffisantes */
  biomasseProduite: number | null;

  // Indicateurs financiers
  /** Cout total des aliments consommes en CFA */
  coutTotalAliment: number;
  /** Cout en CFA par kg de poisson produit — null si biomasse insuffisante */
  coutParKgProduit: number | null;
  /** Revenu total des ventes associees a cette vague en CFA */
  revenuVentes: number;
  /** Marge brute (revenuVentes - coutTotalAliment) — null si revenu absent */
  margeBrute: number | null;
  /** Retour sur investissement en % — null si couts nuls */
  roi: number | null;

  // Structure
  /** Nombre de bacs utilises dans cette vague */
  nombreBacs: number;
}

/**
 * Resultat de la comparaison entre plusieurs vagues.
 *
 * Permet d'identifier les meilleures et moins bonnes performances
 * par campagne de grossissement.
 */
export interface ComparaisonVagues {
  /** Liste des vagues avec leurs indicateurs complets */
  vagues: IndicateursVagueComplet[];
}
