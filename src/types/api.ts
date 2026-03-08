/**
 * DTOs (Data Transfer Objects) pour les endpoints API.
 *
 * Conventions :
 * - Create*DTO : corps du POST pour creer une ressource
 * - Update*DTO : corps du PUT/PATCH pour modifier une ressource
 * - *Response : reponse renvoyee par l'API
 * - *ListResponse : reponse paginee ou liste
 *
 * Aucun `any` — tout est strictement type.
 */

import {
  CauseMortalite,
  MethodeComptage,
  StatutVague,
  TypeAliment,
  TypeReleve,
} from "./models";
import type { Bac, Releve, Vague } from "./models";
import type { IndicateursVague } from "./calculs";

// ---------------------------------------------------------------------------
// Bacs
// ---------------------------------------------------------------------------

/** DTO pour creer un nouveau bac */
export interface CreateBacDTO {
  /** Nom du bac (ex: "Bac 1") */
  nom: string;
  /** Volume en litres */
  volume: number;
  /** Nombre de poissons initial (optionnel, mis a jour via comptages) */
  nombrePoissons?: number;
}

/** Reponse d'un bac avec indication d'occupation */
export interface BacResponse extends Bac {
  /** Code de la vague assignee si occupee, null si libre */
  vagueCode: string | null;
}

/** Reponse liste des bacs */
export interface BacListResponse {
  bacs: BacResponse[];
  /** Nombre total de bacs */
  total: number;
}

// ---------------------------------------------------------------------------
// Vagues
// ---------------------------------------------------------------------------

/** DTO pour creer une nouvelle vague */
export interface CreateVagueDTO {
  /** Code unique de la vague (ex: "VAGUE-2024-001") */
  code: string;
  /** Date de mise en eau (ISO 8601) */
  dateDebut: string;
  /** Nombre d'alevins au demarrage */
  nombreInitial: number;
  /** Poids moyen des alevins en grammes */
  poidsMoyenInitial: number;
  /** Provenance des alevins */
  origineAlevins?: string;
  /** IDs des bacs a assigner a cette vague */
  bacIds: string[];
}

/** DTO pour modifier/cloturer une vague */
export interface UpdateVagueDTO {
  /** Nouveau statut (ex: TERMINEE pour cloturer) */
  statut?: StatutVague;
  /** Date de fin (obligatoire si statut = TERMINEE) */
  dateFin?: string;
  /** Ajouter des bacs a la vague */
  addBacIds?: string[];
  /** Retirer des bacs de la vague */
  removeBacIds?: string[];
}

/** Resume d'une vague pour la liste */
export interface VagueSummaryResponse {
  id: string;
  code: string;
  dateDebut: Date;
  dateFin: Date | null;
  statut: StatutVague;
  nombreInitial: number;
  poidsMoyenInitial: number;
  origineAlevins: string | null;
  /** Nombre de bacs assignes */
  nombreBacs: number;
  /** Nombre de jours depuis le debut */
  joursEcoules: number;
  createdAt: Date;
}

/** Reponse liste des vagues */
export interface VagueListResponse {
  vagues: VagueSummaryResponse[];
  total: number;
}

/** Reponse detaillee d'une vague (GET /api/vagues/[id]) */
export interface VagueDetailResponse {
  vague: Vague;
  bacs: Bac[];
  releves: Releve[];
  indicateurs: IndicateursVague;
}

// ---------------------------------------------------------------------------
// Releves
// ---------------------------------------------------------------------------

/** Champs communs pour la creation d'un releve */
interface CreateReleveBase {
  /** Date du releve (ISO 8601) */
  date: string;
  /** ID de la vague */
  vagueId: string;
  /** ID du bac (doit appartenir a la vague) */
  bacId: string;
  /** Notes libres */
  notes?: string;
}

/** DTO pour creer un releve de biometrie */
export interface CreateReleveBiometrieDTO extends CreateReleveBase {
  typeReleve: TypeReleve.BIOMETRIE;
  /** Poids moyen en grammes */
  poidsMoyen: number;
  /** Taille moyenne en cm */
  tailleMoyenne: number;
  /** Nombre de poissons echantillonnes */
  echantillonCount: number;
}

/** DTO pour creer un releve de mortalite */
export interface CreateReleveMortaliteDTO extends CreateReleveBase {
  typeReleve: TypeReleve.MORTALITE;
  /** Nombre de poissons morts */
  nombreMorts: number;
  /** Cause presumee */
  causeMortalite: CauseMortalite;
}

/** DTO pour creer un releve d'alimentation */
export interface CreateReleveAlimentationDTO extends CreateReleveBase {
  typeReleve: TypeReleve.ALIMENTATION;
  /** Quantite en kg */
  quantiteAliment: number;
  /** Type d'aliment */
  typeAliment: TypeAliment;
  /** Frequence quotidienne */
  frequenceAliment: number;
}

/** DTO pour creer un releve de qualite d'eau */
export interface CreateReleveQualiteEauDTO extends CreateReleveBase {
  typeReleve: TypeReleve.QUALITE_EAU;
  /** Temperature en °C */
  temperature?: number;
  /** pH */
  ph?: number;
  /** Oxygene dissous en mg/L */
  oxygene?: number;
  /** Ammoniac en mg/L */
  ammoniac?: number;
}

/** DTO pour creer un releve de comptage */
export interface CreateReleveComptageDTO extends CreateReleveBase {
  typeReleve: TypeReleve.COMPTAGE;
  /** Nombre de poissons comptes */
  nombreCompte: number;
  /** Methode de comptage */
  methodeComptage: MethodeComptage;
}

/** DTO pour creer un releve d'observation */
export interface CreateReleveObservationDTO extends CreateReleveBase {
  typeReleve: TypeReleve.OBSERVATION;
  /** Description de l'observation */
  description: string;
}

/**
 * Union type pour la creation d'un releve.
 * Le typeReleve determine les champs requis.
 */
export type CreateReleveDTO =
  | CreateReleveBiometrieDTO
  | CreateReleveMortaliteDTO
  | CreateReleveAlimentationDTO
  | CreateReleveQualiteEauDTO
  | CreateReleveComptageDTO
  | CreateReleveObservationDTO;

/** Filtres pour lister les releves (query params) */
export interface ReleveFilters {
  /** Filtrer par vague */
  vagueId?: string;
  /** Filtrer par bac */
  bacId?: string;
  /** Filtrer par type de releve */
  typeReleve?: TypeReleve;
  /** Date de debut (ISO 8601) */
  dateFrom?: string;
  /** Date de fin (ISO 8601) */
  dateTo?: string;
}

/** Reponse liste des releves */
export interface ReleveListResponse {
  releves: Releve[];
  total: number;
}

// ---------------------------------------------------------------------------
// Erreurs API
// ---------------------------------------------------------------------------

/** Format standard des erreurs API */
export interface ApiError {
  /** Code HTTP */
  status: number;
  /** Message d'erreur en francais */
  message: string;
  /** Champ concerne (pour les erreurs de validation) */
  field?: string;
}

/** Reponse d'erreur de validation (400) */
export interface ValidationErrorResponse {
  status: 400;
  message: string;
  errors: Array<{
    field: string;
    message: string;
  }>;
}
