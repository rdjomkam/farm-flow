/**
 * Barrel export — point d'entree unique pour tous les types du projet.
 *
 * Usage :
 * ```ts
 * import { Bac, CreateVagueDTO, IndicateursVague, ReleveTyped } from "@/types";
 * ```
 */

// Modeles et enums Prisma
export {
  StatutVague,
  TypeReleve,
  TypeAliment,
  CauseMortalite,
  MethodeComptage,
} from "./models";
export type {
  Bac,
  BacWithVague,
  Vague,
  VagueWithRelations,
  Releve,
  ReleveWithRelations,
} from "./models";

// Types discrimines pour les releves
export type {
  ReleveBase,
  ReleveBiometrie,
  ReleveMortalite,
  ReleveAlimentation,
  ReleveQualiteEau,
  ReleveComptage,
  ReleveObservation,
  ReleveTyped,
} from "./releves";
export {
  isBiometrie,
  isMortalite,
  isAlimentation,
  isQualiteEau,
  isComptage,
  isObservation,
} from "./releves";

// DTOs API
export type {
  CreateBacDTO,
  BacResponse,
  BacListResponse,
  CreateVagueDTO,
  UpdateVagueDTO,
  VagueSummaryResponse,
  VagueListResponse,
  VagueDetailResponse,
  CreateReleveBiometrieDTO,
  CreateReleveMortaliteDTO,
  CreateReleveAlimentationDTO,
  CreateReleveQualiteEauDTO,
  CreateReleveComptageDTO,
  CreateReleveObservationDTO,
  CreateReleveDTO,
  ReleveFilters,
  ReleveListResponse,
  ApiError,
  ValidationErrorResponse,
} from "./api";

// Types pour les calculs et indicateurs
export type {
  IndicateursVague,
  BilanVague,
  EvolutionPoidsPoint,
  EvolutionMortalitePoint,
  AlimentationPoint,
  DashboardData,
  VagueDashboardSummary,
} from "./calculs";
