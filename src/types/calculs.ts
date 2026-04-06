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
import type { GompertzKLevel } from "@/lib/benchmarks";

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
  /** Poids moyen en grammes (null pour les points de prediction pure) */
  poidsMoyen: number | null;
  /** Jour depuis le debut de la vague (J0, J1, ...) */
  jour: number;
  /** Poids predit par le modele Gompertz en grammes (null si modele non calibre) */
  poidsGompertz?: number | null;
  /** true pour les points de prediction au-dela de la derniere biometrie */
  isPrediction?: boolean;
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
  /** Coefficient de croissance K de Gompertz moyen pondere — null si donnees insuffisantes */
  kMoyenGompertz?: number | null;
  /** Niveau qualitatif du K Gompertz (EXCELLENT | BON | FAIBLE) — null si kMoyenGompertz absent */
  kNiveauGompertz?: GompertzKLevel | null;
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
  /** Coefficient de croissance K de Gompertz pour cette vague — null si donnees insuffisantes */
  kGompertz?: number | null;
  /** Number of distinct feeding periods detected for this product in this vague (ADR-028) */
  nombrePeriodes?: number;
  /** true if feed switches were detected in this vague (ADR-028) */
  avecChangementAliment?: boolean;
  /** true if at least one period used linear interpolation instead of exact biometry (ADR-028) */
  avecInterpolation?: boolean;
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
// ADR-028 — FCR feed-switching accuracy
// ---------------------------------------------------------------------------

/**
 * Coherent feeding period: a contiguous segment on a single tank where one
 * principal product was distributed.
 *
 * Produced by segmenterPeriodesAlimentaires() in src/lib/feed-periods.ts.
 * Used for precise FCR calculation when feed switches occur within a vague.
 *
 * NOTE: bacId is kept here for legacy compatibility with segmenterPeriodesAlimentaires
 * (per-bac segmentation). For vague-level FCR (ADR-033), use PeriodeAlimentaireVague.
 */
export interface PeriodeAlimentaire {
  /** Tank identifier ("unknown" for old records without bacId) */
  bacId: string;
  produitId: string;
  /** First ALIMENTATION releve of the period (inclusive) */
  dateDebut: Date;
  /** Last ALIMENTATION releve of the period (inclusive) */
  dateFin: Date;
  /** Total feed distributed in kg during this period */
  quantiteKg: number;
  /** Average weight (g) at period start — biometry or interpolation */
  poidsMoyenDebut: number | null;
  /** Average weight (g) at period end — biometry or interpolation */
  poidsMoyenFin: number | null;
  /** Estimated number of living fish during this period (at start) */
  nombreVivants: number | null;
  /** Biomass gain (kg) during the period — null if weights unavailable */
  gainBiomasseKg: number | null;
  /** Method used to estimate boundary weights */
  methodeEstimation:
    | "BIOMETRIE_EXACTE"
    | "GOMPERTZ_VAGUE"
    | "INTERPOLATION_LINEAIRE"
    | "VALEUR_INITIALE";
}

/**
 * Coherent feeding period at the vague level — produced by vague-level FCR
 * calculation (ADR-033). Unlike PeriodeAlimentaire, this interface does NOT
 * contain bacId — periods are at the vague level, not per-tank.
 *
 * Produced by segmenterPeriodesAlimentairesVague() in src/lib/feed-periods.ts.
 */
export interface PeriodeAlimentaireVague {
  produitId: string;
  /** First ALIMENTATION releve of the period (inclusive) */
  dateDebut: Date;
  /** Last ALIMENTATION releve of the period (inclusive) */
  dateFin: Date;
  /** Duration in days */
  dureeJours: number;
  /** Total feed distributed in kg during this period */
  quantiteKg: number;
  /** Average weight (g) at period start — estimated from vague-level Gompertz */
  poidsMoyenDebut: number | null;
  /** Average weight (g) at period end — estimated from vague-level Gompertz */
  poidsMoyenFin: number | null;
  /** Estimated number of living fish during this period (total vague population at start) */
  nombreVivants: number | null;
  /** Biomass at start = poidsMoyenDebut × nombreVivants / 1000 in kg */
  biomasseDebutKg: number | null;
  /** Biomass at end = poidsMoyenFin × nombreVivants / 1000 in kg */
  biomasseFinKg: number | null;
  /** Biomass gain (kg) — null if weights unavailable or gain is negative */
  gainBiomasseKg: number | null;
  /** true when the raw gain was negative (period excluded from FCR) */
  gainNegatifExclu: boolean;
  /** Method used to estimate boundary weights (always vague-level) */
  methodeEstimation:
    | "BIOMETRIE_EXACTE"
    | "GOMPERTZ_VAGUE"
    | "INTERPOLATION_LINEAIRE"
    | "VALEUR_INITIALE";
  /** Detailed estimation info for start boundary */
  detailEstimationDebut: FCRTraceEstimationDetail | null;
  /** Detailed estimation info for end boundary */
  detailEstimationFin: FCRTraceEstimationDetail | null;
  /** Period-level FCR = quantiteKg / gainBiomasseKg */
  fcrPeriode: number | null;
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

// ---------------------------------------------------------------------------
// ADR-031 — FCR Transparency Dialog
// ---------------------------------------------------------------------------

/**
 * Methode d'estimation du poids a une borne de periode alimentaire.
 * Alias du discriminant de PeriodeAlimentaire pour reutilisation.
 */
export type MethodeEstimationPoids =
  | "BIOMETRIE_EXACTE"
  | "GOMPERTZ_VAGUE"
  | "INTERPOLATION_LINEAIRE"
  | "VALEUR_INITIALE";

/**
 * Parametres d'un modele Gompertz calibre (au niveau vague ou bac).
 *
 * Affiches dans le dialog de transparence FCR pour montrer la formule
 * avec les valeurs reelles : W(t) = W∞ × exp(−exp(−k × (t − ti)))
 */
export interface FCRTraceGompertzParams {
  /** W∞ — poids asymptotique en grammes */
  wInfinity: number;
  /** k — constante de taux de croissance en 1/jour */
  k: number;
  /** ti — point d'inflexion en jours depuis le debut de la vague */
  ti: number;
  /** R² — coefficient de determination du calibrage */
  r2: number;
  /** Nombre de biometries utilisees pour calibrer le modele */
  biometrieCount: number;
  /** Niveau de confiance du calibrage */
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";
}

/**
 * Detail de l'estimation pour la methode BIOMETRIE_EXACTE.
 */
export interface FCRTraceEstimationBiometrieExacte {
  methode: "BIOMETRIE_EXACTE";
  /** Date du releve biometrique utilise */
  dateBiometrie: Date;
  /** Poids moyen mesure en grammes */
  poidsMesureG: number;
}

/**
 * Detail de l'estimation pour la methode INTERPOLATION_LINEAIRE.
 *
 * Formule : poidsDebut + (poidsFin - poidsDebut) × ratio
 * ou ratio = (targetDate - dateAvant) / (dateApres - dateAvant)
 */
export interface FCRTraceEstimationInterpolationLineaire {
  methode: "INTERPOLATION_LINEAIRE";
  /** Biometrie precedant la date cible (null si absent — extrapolation) */
  pointAvant: { date: Date; poidsMoyenG: number } | null;
  /** Biometrie suivant la date cible (null si absent — extrapolation) */
  pointApres: { date: Date; poidsMoyenG: number } | null;
  /**
   * Ratio d'interpolation entre 0 et 1.
   * Null si un seul point disponible (extrapolation vers la fin).
   */
  ratio: number | null;
}

/**
 * Detail de l'estimation pour la methode GOMPERTZ_VAGUE.
 *
 * Formule : W(t) = W∞ × exp(−exp(−k × (t − ti)))
 */
export interface FCRTraceEstimationGompertz {
  methode: "GOMPERTZ_VAGUE";
  /** t en jours depuis le debut de la vague jusqu'a la date cible */
  tJours: number;
  /** Parametres Gompertz utilises pour l'evaluation */
  params: FCRTraceGompertzParams;
  /** Resultat de l'evaluation en grammes */
  resultatG: number;
}

/**
 * Detail de l'estimation pour la methode VALEUR_INITIALE.
 *
 * Utilise quand aucune biometrie n'est disponible avant la periode.
 */
export interface FCRTraceEstimationValeurInitiale {
  methode: "VALEUR_INITIALE";
  /** Poids moyen initial de la vague, utilise comme fallback */
  poidsMoyenInitialG: number;
}

/**
 * Union discriminee des details d'estimation de poids a une borne.
 */
export type FCRTraceEstimationDetail =
  | FCRTraceEstimationBiometrieExacte
  | FCRTraceEstimationInterpolationLineaire
  | FCRTraceEstimationGompertz
  | FCRTraceEstimationValeurInitiale;

/**
 * Trace d'audit d'une periode alimentaire.
 *
 * Produite par getFCRTrace(). Les periodes sont au niveau vague (ADR-033) —
 * bacId et bacNom ont ete supprimes (DISC-18).
 */
export interface FCRTracePeriode {
  dateDebut: Date;
  dateFin: Date;
  /** Nombre de jours de la periode (dateFin - dateDebut) */
  dureeJours: number;

  /** Quantite d'aliment distribue pendant la periode en kg */
  quantiteKg: number;

  // --- Borne debut ---
  /** Poids moyen estime au debut de la periode en grammes */
  poidsMoyenDebut: number | null;
  /** Methode utilisee pour estimer poidsMoyenDebut */
  methodeDebut: MethodeEstimationPoids;
  /** Detail de l'estimation au debut (biometrie, interpolation, Gompertz...) */
  detailEstimationDebut: FCRTraceEstimationDetail | null;

  // --- Borne fin ---
  /** Poids moyen estime a la fin de la periode en grammes */
  poidsMoyenFin: number | null;
  /** Methode utilisee pour estimer poidsMoyenFin */
  methodeFin: MethodeEstimationPoids;
  /** Detail de l'estimation a la fin (biometrie, interpolation, Gompertz...) */
  detailEstimationFin: FCRTraceEstimationDetail | null;

  /**
   * Methode retenue pour qualifier la periode.
   * Correspond a la moins precise des deux bornes (conservative).
   */
  methodeRetenue: MethodeEstimationPoids;

  // --- Calcul biomasse ---
  /** Nombre de poissons vivants utilise dans le calcul (au debut de la periode) */
  nombreVivants: number | null;
  /** Biomasse au debut = poidsMoyenDebut × nombreVivants / 1000 en kg */
  biomasseDebutKg: number | null;
  /** Biomasse a la fin = poidsMoyenFin × nombreVivants / 1000 en kg */
  biomasseFinKg: number | null;
  /**
   * Gain de biomasse = biomasseFinKg - biomasseDebutKg en kg.
   * Null si les poids sont indisponibles ou si le gain est negatif (exclu).
   */
  gainBiomasseKg: number | null;
  /**
   * true si le gain brut calcule etait negatif.
   * Explique pourquoi la periode ne contribue pas au FCR agregee.
   */
  gainNegatifExclu: boolean;

  // --- FCR periode ---
  /** FCR de la periode = quantiteKg / gainBiomasseKg (null si gain indisponible) */
  fcrPeriode: number | null;

}

/**
 * Contribution d'une vague au FCR final d'un aliment.
 *
 * Contient le resume de la vague et la liste des periodes alimentaires
 * segmentees pour cet aliment.
 */
export interface FCRTraceVague {
  vagueId: string;
  vagueCode: string;
  dateDebut: Date;
  /** Null si la vague est encore en cours */
  dateFin: Date | null;
  /** Nombre d'alevins places en debut de vague */
  nombreInitial: number;
  /** Poids moyen initial de la vague en grammes */
  poidsMoyenInitial: number;
  /** Nombre de poissons vivants estime a la fin de la periode */
  nombreVivantsEstime: number | null;

  /** Quantite totale de cet aliment dans cette vague en kg */
  quantiteKg: number;
  /** Gain de biomasse agregee des periodes valides en kg (null si aucun gain positif) */
  gainBiomasseKg: number | null;
  /** FCR calcule pour cette vague (null si gainBiomasseKg est null) */
  fcrVague: number | null;

  /**
   * Parametres Gompertz au niveau vague si le modele est calibre.
   * Null si aucun modele Gompertz disponible pour cette vague.
   */
  gompertzVague: FCRTraceGompertzParams | null;

  /** Periodes alimentaires pour cet aliment dans cette vague */
  periodes: FCRTracePeriode[];
}

/**
 * Trace d'audit complete du calcul FCR pour un produit aliment.
 *
 * Retournee par GET /api/analytics/aliments/[produitId]/fcr-trace.
 * Structuree en 3 niveaux : produit → vagues → periodes.
 *
 * Permet a un pisciculteur ou agronome de reproduire manuellement
 * le FCR affiche sur la page de comparaison des aliments.
 */
export interface FCRTrace {
  produitId: string;
  produitNom: string;
  fournisseurNom: string | null;
  /** Prix unitaire en CFA/kg (base d'achat) */
  prixUnitaire: number;

  /**
   * Nombre minimal de biometries requis pour activer Gompertz.
   * Null si ConfigElevage n'est pas renseignee (utilise le defaut = 5).
   */
  gompertzMinPoints: number | null;

  /** FCR final agrege (identique a AnalytiqueAliment.fcrMoyen) */
  fcrMoyenFinal: number | null;

  /** Quantite totale aliment sur toutes les vagues en kg */
  quantiteTotaleFinal: number;

  /**
   * Gain de biomasse total agrege (somme des gains positifs de toutes les periodes)
   * en kg. Null si aucune periode n'a un gain positif.
   */
  gainBiomasseTotalFinal: number | null;

  /** Ventilation par vague */
  parVague: FCRTraceVague[];
}
