/**
 * Types discrimines pour les releves.
 *
 * En base, Releve est un seul modele avec des champs nullables.
 * Cote TypeScript, on utilise un union type discrimine par `typeReleve`
 * pour garantir que les champs requis pour chaque type sont bien presents.
 *
 * Cela ameliore l'autocompletion et la verification a la compilation.
 */

import {
  CauseMortalite,
  MethodeComptage,
  TypeAliment,
  TypeReleve,
} from "./models";

// ---------------------------------------------------------------------------
// Base commune a tous les releves
// ---------------------------------------------------------------------------

/** Champs communs a tous les types de releves */
export interface ReleveBase {
  id: string;
  date: Date;
  vagueId: string;
  bacId: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Types specifiques
// ---------------------------------------------------------------------------

/** Releve de biometrie — echantillonnage de poids et taille */
export interface ReleveBiometrie extends ReleveBase {
  typeReleve: TypeReleve.BIOMETRIE;
  /** Poids moyen de l'echantillon en grammes */
  poidsMoyen: number;
  /** Taille moyenne de l'echantillon en cm */
  tailleMoyenne: number;
  /** Nombre de poissons echantillonnes */
  echantillonCount: number;
}

/** Releve de mortalite — poissons morts constates */
export interface ReleveMortalite extends ReleveBase {
  typeReleve: TypeReleve.MORTALITE;
  /** Nombre de poissons morts */
  nombreMorts: number;
  /** Cause presumee */
  causeMortalite: CauseMortalite;
}

/** Releve d'alimentation — distribution de nourriture */
export interface ReleveAlimentation extends ReleveBase {
  typeReleve: TypeReleve.ALIMENTATION;
  /** Quantite d'aliment en kg */
  quantiteAliment: number;
  /** Type d'aliment distribue */
  typeAliment: TypeAliment;
  /** Nombre de distributions dans la journee */
  frequenceAliment: number;
}

/** Releve de qualite de l'eau — parametres physico-chimiques */
export interface ReleveQualiteEau extends ReleveBase {
  typeReleve: TypeReleve.QUALITE_EAU;
  /** Temperature en degres Celsius */
  temperature: number | null;
  /** pH */
  ph: number | null;
  /** Oxygene dissous en mg/L */
  oxygene: number | null;
  /** Ammoniac en mg/L */
  ammoniac: number | null;
}

/** Releve de comptage — denombrement des poissons vivants */
export interface ReleveComptage extends ReleveBase {
  typeReleve: TypeReleve.COMPTAGE;
  /** Nombre de poissons comptes */
  nombreCompte: number;
  /** Methode utilisee pour le comptage */
  methodeComptage: MethodeComptage;
}

/** Releve d'observation — note textuelle libre */
export interface ReleveObservation extends ReleveBase {
  typeReleve: TypeReleve.OBSERVATION;
  /** Description de l'observation */
  description: string;
}

// ---------------------------------------------------------------------------
// Union type discrimine
// ---------------------------------------------------------------------------

/**
 * Union type discrimine par `typeReleve`.
 *
 * Utilisation avec narrowing :
 * ```ts
 * function handleReleve(r: ReleveTyped) {
 *   switch (r.typeReleve) {
 *     case TypeReleve.BIOMETRIE:
 *       console.log(r.poidsMoyen); // TS sait que poidsMoyen existe
 *       break;
 *     case TypeReleve.MORTALITE:
 *       console.log(r.nombreMorts); // TS sait que nombreMorts existe
 *       break;
 *   }
 * }
 * ```
 */
export type ReleveTyped =
  | ReleveBiometrie
  | ReleveMortalite
  | ReleveAlimentation
  | ReleveQualiteEau
  | ReleveComptage
  | ReleveObservation;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/** Verifie si un releve est de type biometrie */
export function isBiometrie(r: ReleveTyped): r is ReleveBiometrie {
  return r.typeReleve === TypeReleve.BIOMETRIE;
}

/** Verifie si un releve est de type mortalite */
export function isMortalite(r: ReleveTyped): r is ReleveMortalite {
  return r.typeReleve === TypeReleve.MORTALITE;
}

/** Verifie si un releve est de type alimentation */
export function isAlimentation(r: ReleveTyped): r is ReleveAlimentation {
  return r.typeReleve === TypeReleve.ALIMENTATION;
}

/** Verifie si un releve est de type qualite eau */
export function isQualiteEau(r: ReleveTyped): r is ReleveQualiteEau {
  return r.typeReleve === TypeReleve.QUALITE_EAU;
}

/** Verifie si un releve est de type comptage */
export function isComptage(r: ReleveTyped): r is ReleveComptage {
  return r.typeReleve === TypeReleve.COMPTAGE;
}

/** Verifie si un releve est de type observation */
export function isObservation(r: ReleveTyped): r is ReleveObservation {
  return r.typeReleve === TypeReleve.OBSERVATION;
}
