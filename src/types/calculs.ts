/**
 * Types pour les indicateurs de performance piscicole.
 *
 * Ces indicateurs sont calcules a partir des releves d'une vague.
 * Les fonctions de calcul correspondantes sont dans src/lib/calculs.ts.
 */

import {
  StatutVague,
  TailleGranule,
  FormeAliment,
  PhaseElevage,
  ScoreAlimentConfig,
} from "./models";
import type { GompertzParams } from "@/lib/gompertz";

// Re-export pour que les consommateurs n'aient pas a importer depuis models
export type { ScoreAlimentConfig };

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

/**
 * Indicateurs de benchmark pour une vague, utilises dans le panel du dashboard.
 * Chaque metrique inclut sa valeur numerique et son niveau de benchmark evalue.
 */
export interface IndicateursBenchmarkVague {
  vagueId: string;
  vagueCode: string;
  /** Taux de survie en % — null si donnees insuffisantes */
  tauxSurvie: number | null;
  /** FCR — null si donnees insuffisantes */
  fcr: number | null;
  /** SGR en %/jour — null si donnees insuffisantes */
  sgr: number | null;
  /** Taux de mortalite en % — null si donnees insuffisantes */
  tauxMortalite: number | null;
  /** Densite en poissons/m3 — null si volume de bac absent */
  densite: number | null;
  /** Nombre de poissons vivants estime */
  nombreVivants: number | null;
  /** ID de l'activite corrective la plus recente si niveau MAUVAIS */
  activiteCorrectiveId: string | null;
  /** Titre de l'activite corrective si niveau MAUVAIS */
  activiteCorrectiveTitre: string | null;
}

// ---------------------------------------------------------------------------
// Sprint 22 (S16-5) — Projections de performance
// ---------------------------------------------------------------------------

/**
 * Point de donnee pour la courbe de croissance projetee.
 * Combine les donnees reelles (passees) et projetees (futures) pour Recharts.
 */
export interface CourbeCroissancePoint {
  /** Numero du jour depuis le debut de la vague */
  jour: number;
  /** Poids moyen reel en grammes (null pour les points futurs) */
  poidsReel: number | null;
  /** Poids moyen projete en grammes (null pour les points passes) */
  poidsProjecte: number | null;
  /** Poids predit par le modele Gompertz en grammes (null si modele non calibre) */
  poidsGompertz?: number | null;
}

/**
 * Projection de performance pour une vague active.
 *
 * Calculee a partir du poids moyen actuel, du SGR actuel et de la ConfigElevage.
 */
export interface ProjectionVague {
  /** ID de la vague */
  vagueId: string;
  /** Code de la vague */
  vagueCode: string;

  // SGR
  /** SGR actuel en %/jour (null si pas assez de donnees biometriques) */
  sgrActuel: number | null;
  /** SGR requis pour atteindre l'objectif en %/jour */
  sgrRequis: number | null;
  /** true si sgrActuel >= sgrRequis (en avance ou dans les temps) */
  enAvance: boolean | null;

  // Date recolte
  /** Date de recolte estimee avec le SGR actuel */
  dateRecolteEstimee: Date | null;
  /** Nombre de jours restants projetes */
  joursRestantsEstimes: number | null;

  // Aliment
  /** Aliment total restant estime en kg */
  alimentRestantEstime: number | null;

  // Revenu
  /** Revenu attendu estime en CFA (null si prixVenteKg non renseigne) */
  revenuAttendu: number | null;

  // Graphique
  /** Points pour la courbe de croissance (reelle + projetee) */
  courbeProjection: CourbeCroissancePoint[];

  // Contexte
  /** Poids moyen actuel en grammes */
  poidsMoyenActuel: number | null;
  /** Poids objectif en grammes (depuis ConfigElevage) */
  poidsObjectif: number;
  /** Nombre de jours ecoules depuis le debut de la vague */
  joursEcoules: number;
}

/**
 * Extension de ProjectionVague avec les donnees du modele Gompertz.
 *
 * Tous les champs Gompertz sont optionnels pour garantir la compatibilite
 * ascendante avec les projections SGR existantes.
 */
export interface ProjectionVagueV2 extends ProjectionVague {
  /**
   * Parametres Gompertz calibres (W∞, K, ti).
   * Null si moins de 5 points biometriques sont disponibles.
   */
  gompertzParams?: GompertzParams | null;

  /**
   * Coefficient de determination R² du modele Gompertz calibre.
   * Null si le modele n'a pas pu etre calibre.
   */
  gompertzR2?: number | null;

  /**
   * Niveau de confiance qualitatif du calibrage Gompertz.
   * Valeurs possibles : "INSUFFICIENT_DATA" | "LOW" | "MEDIUM" | "HIGH"
   * Null si le modele n'a pas pu etre calibre.
   */
  gompertzConfidence?: string | null;

  /**
   * Nombre de jours restants avant d'atteindre le poids objectif
   * selon la projection Gompertz.
   * Null si le modele n'est pas calibre ou si le poids objectif
   * depasse le poids asymptotique W∞.
   */
  dateRecolteGompertz?: number | null;
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
  /** Volume du bac en litres (nullable pour les bacs provisionnés) */
  volume: number | null;
  // Monitoring metrics (performance metrics like FCR/SGR/survie are tracked at vague level)
  /** Biomasse totale en kg */
  biomasse: number | null;
  /** Poids moyen actuel en grammes */
  poidsMoyen: number | null;
  /** Densite de biomasse en kg/m³ */
  densite: number | null;
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
  /** Alertes generees sur les bacs */
  alertes: AlerteBac[];
}

/**
 * Alerte generee quand un indicateur de bac depasse un seuil critique.
 */
export interface AlerteBac {
  bacId: string;
  bacNom: string;
  type: "MORTALITE_HAUTE" | "DENSITE_ELEVEE";
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
  volume: number | null;
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
  biomasse: number | null;
  poidsMoyen: number | null;
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
  /** Taille du granule — null si non renseignee */
  tailleGranule: TailleGranule | null;
  /** Forme physique de l'aliment — null si non renseignee */
  formeAliment: FormeAliment | null;
  /** Taux de proteines brutes en % MS — null si non renseigne */
  tauxProteines: number | null;
  /** ADG moyen (Average Daily Gain) en g/jour — null si donnees insuffisantes */
  adgMoyen: number | null;
  /** PER moyen (Protein Efficiency Ratio) — null si donnees insuffisantes */
  perMoyen: number | null;
  /** Score qualite /10. Null si FCR et SGR tous deux absents. */
  scoreQualite: number | null;
  /** Phases d'elevage ciblees par cet aliment */
  phasesCibles: PhaseElevage[];
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
  /** ADG (Average Daily Gain) en g/jour — null si donnees insuffisantes */
  adg: number | null;
  /** PER (Protein Efficiency Ratio) — null si donnees insuffisantes */
  per: number | null;
  /** Taux de mortalite associe a cette vague (%) — null si donnees insuffisantes */
  tauxMortaliteAssocie: number | null;
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
   * Bac ayant la densite la plus basse parmi toutes les vagues actives.
   * Null si aucun bac n'a de donnees suffisantes.
   */
  meilleurBac: {
    id: string;
    nom: string;
    densite: number;
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
   * Nombre total d'alertes de monitoring actives (densite elevee, mortalite haute).
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

// ---------------------------------------------------------------------------
// Sprint FB — Feed Analytics v2
// ---------------------------------------------------------------------------

/**
 * Filtres pour la page analytics aliments.
 *
 * Tous les champs sont optionnels — null ou undefined signifie "pas de filtre".
 */
export interface FiltresAnalyticsAliments {
  phase?: PhaseElevage;
  tailleGranule?: TailleGranule;
  formeAliment?: FormeAliment;
  /** Saison au format "YYYY" ou label metier (ex. "SAISON_SECHE_2026") */
  saison?: string;
}

/**
 * Point de donnees FCR hebdomadaire pour le graphique de tendance.
 *
 * Utilise par Recharts LineChart dans la page detail aliment.
 */
export interface FCRHebdomadairePoint {
  /** Semaine au format ISO "YYYY-WNN" (ex. "2026-W12") */
  semaine: string;
  /** FCR calcule sur la semaine — null si donnees insuffisantes */
  fcr: number | null;
  /** Quantite totale d'aliment distribue cette semaine en kg */
  quantiteAlimentKg: number;
  /** Poids moyen interpole en grammes — null si pas de biometrie cette semaine */
  poidsMoyenG: number | null;
  /** FCR de reference de la litterature pour comparaison — null si non applicable */
  benchmarkFCR: number | null;
}

/**
 * Detection de changement de granule au cours d'une vague.
 *
 * Genere une annotation sur le graphique FCR hebdomadaire.
 */
export interface ChangementGranule {
  date: Date;
  ancienneTaille: TailleGranule;
  nouvelleTaille: TailleGranule;
}

/**
 * Alerte de ration (sur-alimentation ou sous-alimentation).
 *
 * Generee quand l'ecart entre ration distribuee et ration recommandee
 * depasse un seuil pendant plusieurs releves consecutifs.
 */
export interface AlerteRation {
  vagueId: string;
  vagueNom: string;
  /** Type d'ecart detecte */
  type: "SOUS_ALIMENTATION" | "SUR_ALIMENTATION";
  /** Ecart moyen en pourcentage (positif = surplus, negatif = deficit) */
  ecartMoyenPct: number;
  /** Nombre de releves consecutifs avec l'ecart detecte */
  relevesConsecutifs: number;
}

// ScoreAlimentConfig est definie dans models.ts (evite la dependance circulaire)
// et re-exportee depuis ce fichier via le re-export en haut.
