import { TypeReleve, CauseMortalite, TypeAliment, ComportementAlimentaire, MethodeComptage } from "@/types";

/** Limite de pagination par defaut pour la page /releves */
export const RELEVES_PAGE_LIMIT = 20;

/** Valeur sentinelle "Tout" dans les Selects */
export const ALL_VALUE = "__all__";

/** Filtres UI derives des URL search params — tous optionnels et strings bruts */
export interface ReleveSearchParams {
  vagueId?: string;
  bacId?: string;
  typeReleve?: string;
  dateFrom?: string; // format "YYYY-MM-DD"
  dateTo?: string;   // format "YYYY-MM-DD"
  modifie?: string;  // "true" | undefined
  offset?: string;   // string car searchParams toujours string

  // Filtres specifiques BIOMETRIE
  poidsMoyenMin?: string;
  poidsMoyenMax?: string;
  tailleMoyenneMin?: string;
  tailleMoyenneMax?: string;

  // Filtres specifiques MORTALITE
  causeMortalite?: string;
  nombreMortsMin?: string;
  nombreMortsMax?: string;

  // Filtres specifiques ALIMENTATION
  typeAliment?: string;
  comportementAlim?: string;
  frequenceAlimentMin?: string;
  frequenceAlimentMax?: string;
  produitId?: string; // filtre par produit alimentaire (remplace typeAliment + comportementAlim dans l'UI)

  // Filtres specifiques QUALITE_EAU
  temperatureMin?: string;
  temperatureMax?: string;
  phMin?: string;
  phMax?: string;

  // Filtres specifiques COMPTAGE
  methodeComptage?: string;

  // Filtres specifiques OBSERVATION
  descriptionSearch?: string;

  // Filtres specifiques RENOUVELLEMENT
  pourcentageMin?: string;
  pourcentageMax?: string;
}

/**
 * Constante exportee — partagee entre filter-bar, filter-sheet, active-filters
 * et updateMultipleParams pour garantir le reset complet de tous les filtres.
 */
export const ALL_FILTER_PARAMS = [
  "vagueId",
  "bacId",
  "typeReleve",
  "dateFrom",
  "dateTo",
  "modifie",
  "poidsMoyenMin",
  "poidsMoyenMax",
  "tailleMoyenneMin",
  "tailleMoyenneMax",
  "causeMortalite",
  "nombreMortsMin",
  "nombreMortsMax",
  "typeAliment",
  "comportementAlim",
  "frequenceAlimentMin",
  "frequenceAlimentMax",
  "produitId",
  "temperatureMin",
  "temperatureMax",
  "phMin",
  "phMax",
  "methodeComptage",
  "descriptionSearch",
  "pourcentageMin",
  "pourcentageMax",
] as const;

/** Resultat parse et valide, pret pour getReleves() */
export interface ParsedReleveFilters {
  vagueId?: string;
  bacId?: string;
  typeReleve?: TypeReleve;
  dateFrom?: string;
  dateTo?: string;
  modifie?: boolean;
  offset: number;  // toujours defini (defaut 0)
  limit: number;   // toujours defini (defaut RELEVES_PAGE_LIMIT)

  // Filtres specifiques BIOMETRIE (inclus seulement si typeReleve === BIOMETRIE)
  poidsMoyenMin?: number;
  poidsMoyenMax?: number;
  tailleMoyenneMin?: number;
  tailleMoyenneMax?: number;

  // Filtres specifiques MORTALITE (inclus seulement si typeReleve === MORTALITE)
  causeMortalite?: CauseMortalite;
  nombreMortsMin?: number;
  nombreMortsMax?: number;

  // Filtres specifiques ALIMENTATION (inclus seulement si typeReleve === ALIMENTATION)
  typeAliment?: TypeAliment;
  comportementAlim?: ComportementAlimentaire;
  frequenceAlimentMin?: number;
  frequenceAlimentMax?: number;
  produitId?: string; // filtre par produit alimentaire

  // Filtres specifiques QUALITE_EAU (inclus seulement si typeReleve === QUALITE_EAU)
  temperatureMin?: number;
  temperatureMax?: number;
  phMin?: number;
  phMax?: number;

  // Filtres specifiques COMPTAGE (inclus seulement si typeReleve === COMPTAGE)
  methodeComptage?: MethodeComptage;

  // Filtres specifiques OBSERVATION (inclus seulement si typeReleve === OBSERVATION)
  descriptionSearch?: string;

  // Filtres specifiques RENOUVELLEMENT (inclus seulement si typeReleve === RENOUVELLEMENT)
  pourcentageMin?: number;
  pourcentageMax?: number;
}

/** Parse un nombre flottant depuis une string — retourne undefined si NaN ou negatif */
function parsePositiveFloat(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = parseFloat(s);
  return isNaN(n) || n < 0 ? undefined : n;
}

/** Valide et parse les URL search params vers des filtres types */
export function parseReleveSearchParams(
  params: ReleveSearchParams
): ParsedReleveFilters {
  const typeReleve =
    params.typeReleve &&
    params.typeReleve !== ALL_VALUE &&
    Object.values(TypeReleve).includes(params.typeReleve as TypeReleve)
      ? (params.typeReleve as TypeReleve)
      : undefined;

  const offset = Math.max(0, parseInt(params.offset ?? "0", 10) || 0);

  const result: ParsedReleveFilters = {
    vagueId: params.vagueId || undefined,
    bacId: params.bacId || undefined,
    typeReleve,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    modifie: params.modifie === "true" ? true : undefined,
    offset,
    limit: RELEVES_PAGE_LIMIT,
  };

  // Filtres specifiques — inclus seulement si typeReleve correspond
  if (typeReleve === TypeReleve.BIOMETRIE) {
    const pMin = parsePositiveFloat(params.poidsMoyenMin);
    const pMax = parsePositiveFloat(params.poidsMoyenMax);
    const tMin = parsePositiveFloat(params.tailleMoyenneMin);
    const tMax = parsePositiveFloat(params.tailleMoyenneMax);
    if (pMin !== undefined) result.poidsMoyenMin = pMin;
    if (pMax !== undefined) result.poidsMoyenMax = pMax;
    if (tMin !== undefined) result.tailleMoyenneMin = tMin;
    if (tMax !== undefined) result.tailleMoyenneMax = tMax;
  }

  if (typeReleve === TypeReleve.MORTALITE) {
    if (
      params.causeMortalite &&
      Object.values(CauseMortalite).includes(params.causeMortalite as CauseMortalite)
    ) {
      result.causeMortalite = params.causeMortalite as CauseMortalite;
    }
    const nMin = parsePositiveFloat(params.nombreMortsMin);
    const nMax = parsePositiveFloat(params.nombreMortsMax);
    if (nMin !== undefined) result.nombreMortsMin = nMin;
    if (nMax !== undefined) result.nombreMortsMax = nMax;
  }

  if (typeReleve === TypeReleve.ALIMENTATION) {
    if (
      params.typeAliment &&
      Object.values(TypeAliment).includes(params.typeAliment as TypeAliment)
    ) {
      result.typeAliment = params.typeAliment as TypeAliment;
    }
    if (
      params.comportementAlim &&
      Object.values(ComportementAlimentaire).includes(params.comportementAlim as ComportementAlimentaire)
    ) {
      result.comportementAlim = params.comportementAlim as ComportementAlimentaire;
    }
    const fMin = parsePositiveFloat(params.frequenceAlimentMin);
    const fMax = parsePositiveFloat(params.frequenceAlimentMax);
    if (fMin !== undefined) result.frequenceAlimentMin = fMin;
    if (fMax !== undefined) result.frequenceAlimentMax = fMax;
    if (params.produitId) result.produitId = params.produitId;
  }

  if (typeReleve === TypeReleve.QUALITE_EAU) {
    const tMin = parsePositiveFloat(params.temperatureMin);
    const tMax = parsePositiveFloat(params.temperatureMax);
    const pMin = parsePositiveFloat(params.phMin);
    const pMax = parsePositiveFloat(params.phMax);
    if (tMin !== undefined) result.temperatureMin = tMin;
    if (tMax !== undefined) result.temperatureMax = tMax;
    if (pMin !== undefined) result.phMin = pMin;
    if (pMax !== undefined) result.phMax = pMax;
  }

  if (typeReleve === TypeReleve.COMPTAGE) {
    if (
      params.methodeComptage &&
      Object.values(MethodeComptage).includes(params.methodeComptage as MethodeComptage)
    ) {
      result.methodeComptage = params.methodeComptage as MethodeComptage;
    }
  }

  if (typeReleve === TypeReleve.OBSERVATION) {
    if (params.descriptionSearch) {
      result.descriptionSearch = params.descriptionSearch;
    }
  }

  if (typeReleve === TypeReleve.RENOUVELLEMENT) {
    const pMin = parsePositiveFloat(params.pourcentageMin);
    const pMax = parsePositiveFloat(params.pourcentageMax);
    if (pMin !== undefined) result.pourcentageMin = pMin;
    if (pMax !== undefined) result.pourcentageMax = pMax;
  }

  return result;
}

/** Compte le nombre de filtres actifs (hors pagination).
 * Les paires min/max comptent pour 1 filtre (pas 2).
 */
export function countActiveFilters(params: ReleveSearchParams): number {
  let count = 0;
  if (params.vagueId) count++;
  if (params.bacId) count++;
  if (params.typeReleve && params.typeReleve !== ALL_VALUE) count++;
  if (params.dateFrom) count++;
  if (params.dateTo) count++;
  if (params.modifie === "true") count++;

  // Filtres specifiques BIOMETRIE — paires min/max comptent pour 1
  if (params.poidsMoyenMin || params.poidsMoyenMax) count++;
  if (params.tailleMoyenneMin || params.tailleMoyenneMax) count++;

  // Filtres specifiques MORTALITE
  if (params.causeMortalite) count++;
  if (params.nombreMortsMin || params.nombreMortsMax) count++;

  // Filtres specifiques ALIMENTATION
  if (params.typeAliment) count++;
  if (params.comportementAlim) count++;
  if (params.frequenceAlimentMin || params.frequenceAlimentMax) count++;
  if (params.produitId) count++;

  // Filtres specifiques QUALITE_EAU
  if (params.temperatureMin || params.temperatureMax) count++;
  if (params.phMin || params.phMax) count++;

  // Filtres specifiques COMPTAGE
  if (params.methodeComptage) count++;

  // Filtres specifiques OBSERVATION
  if (params.descriptionSearch) count++;

  // Filtres specifiques RENOUVELLEMENT
  if (params.pourcentageMin || params.pourcentageMax) count++;

  return count;
}

/** Formate une date ISO en "DD/MM" pour l'affichage des chips */
export function formatDateChip(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
  } catch {
    return dateStr;
  }
}
