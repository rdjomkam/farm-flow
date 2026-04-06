/**
 * Types TypeScript pour l'algorithme FCR par aliment (ADR-036).
 *
 * Cet algorithme calcule le FCR en partant des ReleveConsommation (pas de Bac.vagueId)
 * ce qui permet d'inclure les bacs desassignes apres un calibrage.
 *
 * Reference : docs/decisions/ADR-036-fcr-by-feed-algorithm.md
 */

// ─── Inputs ────────────────────────────────────────────────────────────────

export interface FCRByFeedParams {
  /** Nombre minimum de points biometriques pour Gompertz. Defaut : 5 */
  minPoints?: number;
  /** Poids asymptotique W∞ (g). Null = utiliser ConfigElevage ou CLARIAS_DEFAULTS. */
  wInfinity?: number | null;
}

// ─── Types intermediaires internes ────────────────────────────────────────

/**
 * Classification d'un jour de consommation dans un bac.
 */
export type JourConsommationType = "EXCLUSIVE" | "MIXED";

/**
 * Periode de consommation d'un aliment dans un bac (Step 5).
 */
export interface PeriodeBacFCR {
  bacId: string;
  bacNom: string;
  dateDebut: Date;
  dateFin: Date;
  /** Nombre de jours calendaires (dateFin - dateDebut + 1) */
  dureeJours: number;
  /** Quantite totale aliment cible en kg (jours exclusifs + jours mixtes rattaches) */
  qtyTargetKg: number;
  /** Nombre de jours exclusifs */
  joursExclusifs: number;
  /** Nombre de jours mixtes rattaches */
  joursMixtes: number;
}

/**
 * Estimation de la population d'un bac sur une periode (Step 6).
 */
export interface EstimationPopulationBac {
  bacId: string;
  countDebut: number;
  countFin: number;
  avgCount: number;
  methode: "COMPTAGE_ANCRAGE" | "PROPORTIONNEL_INITIAL";
}

// ─── Types de sortie ──────────────────────────────────────────────────────

/**
 * FCR calcule pour une periode dans un bac (Step 7).
 * Utilise dans DetailAlimentVague.periodesBac et FCRByFeedVague.periodesBac.
 */
export interface FCRBacPeriode {
  bacId: string;
  bacNom: string;
  dateDebut: Date;
  dateFin: Date;
  dureeJours: number;
  qtyAlimentKg: number;
  /** Gain de poids par poisson (g) = Σ dailyGain(t) pour t in [debut, fin] */
  gainParPoissonG: number;
  avgFishCount: number;
  /** gainParPoissonG × avgFishCount / 1000 (kg) */
  gainBiomasseKg: number;
  /** null si gainBiomasseKg <= 0 */
  fcr: number | null;
  /** FCR > 3.0 — possible erreur ou tres peu de poissons */
  flagHighFCR: boolean | null;
}

/**
 * FCR agrege pour une vague, avec detail par bac × periode.
 */
export interface FCRByFeedVague {
  vagueId: string;
  vagueCode: string;
  dateDebut: Date;
  dateFin: Date | null;

  /** Parametres Gompertz calibres (null si donnees insuffisantes) */
  gompertz: {
    wInfinity: number;
    k: number;
    ti: number;
    r2: number;
    biometrieCount: number;
    confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";
  } | null;

  /** R² < 0.85 → FCR peu fiable */
  flagLowConfidence: boolean;
  /** < minPoints biometries → vague ignoree de l'agregation globale */
  insufficientData: boolean;

  totalAlimentKg: number;
  totalGainBiomasseKg: number;
  /** null si aucune periode valide */
  fcrVague: number | null;

  periodesBac: FCRBacPeriode[];
}

/**
 * Resultat complet de l'algorithme FCR par aliment.
 * Integre dans DetailAliment.fcr-by-feed et retourne en standalone par getFCRByFeed.
 */
export interface FCRByFeedResult {
  produitId: string;
  produitNom: string;
  fournisseurNom: string | null;
  prixUnitaire: number;
  params: { minPoints: number; wInfinity: number | null };
  fcrGlobal: number | null;
  totalAlimentKg: number;
  totalGainBiomasseKg: number;
  nombreVaguesIncluses: number;
  nombreVaguesIgnorees: number;
  parVague: FCRByFeedVague[];
}
