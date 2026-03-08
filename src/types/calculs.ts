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
