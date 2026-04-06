import { TypeReleve } from "@/types";

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
}

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

  return {
    vagueId: params.vagueId || undefined,
    bacId: params.bacId || undefined,
    typeReleve,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    modifie: params.modifie === "true" ? true : undefined,
    offset,
    limit: RELEVES_PAGE_LIMIT,
  };
}

/** Compte le nombre de filtres actifs (hors pagination) */
export function countActiveFilters(params: ReleveSearchParams): number {
  let count = 0;
  if (params.vagueId) count++;
  if (params.bacId) count++;
  if (params.typeReleve && params.typeReleve !== ALL_VALUE) count++;
  if (params.dateFrom) count++;
  if (params.dateTo) count++;
  if (params.modifie === "true") count++;
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
