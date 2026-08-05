/**
 * src/components/previsions/rapprochement-dto.ts
 *
 * Conversion `Decimal` (moteur, `src/lib/queries/previsions-vue-rapprochement.ts`)
 * -> `number`/DTO simple (`rapprochement-types.ts`), a la frontiere Server
 * -> Client — meme convention que `n()` de `previsions-scenario-detail-page.tsx`
 * (un `Decimal`, qu'il vienne de Prisma ou de `decimal.js`, ne peut pas
 * traverser cette frontiere). Ce fichier NE RECALCULE RIEN : il ne fait que
 * lire des champs deja tranches par le moteur
 * (`sens`/`couleur`/`ecartAbsolu`/`ecartPct`, deja presents sur
 * `LigneRapprochement`/`ComparaisonChiffree`) et les convertir en `number`.
 */
import type { Decimal } from "@/lib/previsions/decimal-config";
import type { LigneRapprochement } from "@/lib/previsions/types";
import type { AgregatEcart, AgregatMois } from "@/lib/previsions/rapprochement";
import { couleurPourSensEcart, SEUILS_ECART_PAR_DEFAUT } from "@/lib/previsions/rapprochement";
import type { AgregatPosteComparaison, RapprochementScenarioVue } from "@/lib/queries/previsions-vue-rapprochement";
import type {
  AgregatEcartDTO,
  AgregatPosteDTO,
  LigneRapprochementDTO,
  RapprochementScenarioDTO,
  VagueRapprochementRowDTO,
} from "@/components/previsions/rapprochement-types";
import type { VagueRapprochementRow, ComparaisonChiffree } from "@/lib/previsions/rapprochement-vagues";

function n(value: Decimal): number {
  return value.toNumber();
}
function nOrNull(value: Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

/**
 * Une `LigneRapprochement` porte deja `sens` (moteur) mais pas `couleur` —
 * calculee ICI en appelant `couleurPourSensEcart` (moteur), jamais
 * reimplementee (ERR-171). C'est la SEULE fonction de conversion qui
 * calcule quelque chose ; elle appelle exclusivement le moteur.
 */
function versLigneDTO(l: LigneRapprochement): LigneRapprochementDTO {
  return {
    id: l.id,
    moisAbsolu: l.moisAbsolu,
    libelle: l.libelle,
    natureGrandeur: l.natureGrandeur,
    prevu: n(l.prevu),
    reel: nOrNull(l.reel),
    statutRapprochement: l.statutRapprochement,
    ecartAbsolu: nOrNull(l.ecartAbsolu),
    ecartPct: nOrNull(l.ecartPct),
    sens: l.sens,
    couleur: couleurPourSensEcart(l.sens, l.ecartPct, SEUILS_ECART_PAR_DEFAUT),
  };
}

function versAgregatEcartDTO(a: AgregatEcart): AgregatEcartDTO {
  return {
    totalPrevu: n(a.totalPrevu),
    totalReel: n(a.totalReel),
    totalEcartAbsolu: n(a.totalEcartAbsolu),
    nombreLignes: a.nombreLignes,
    nombreLignesSansSourceReelle: a.nombreLignesSansSourceReelle,
    nombreLignesNonRapprochees: a.nombreLignesNonRapprochees,
  };
}

function versAgregatPosteDTO(a: AgregatPosteComparaison): AgregatPosteDTO {
  return {
    ...versAgregatEcartDTO(a),
    cle: a.cle,
    libelle: a.libelle,
    natureGrandeur: a.natureGrandeur,
    ecartPct: nOrNull(a.ecartPct),
    sens: a.sens,
    couleur: a.couleur,
  };
}

function versComparaisonDTO(c: ComparaisonChiffree) {
  return {
    prevu: nOrNull(c.prevu),
    reel: nOrNull(c.reel),
    ecartAbsolu: nOrNull(c.ecartAbsolu),
    ecartPct: nOrNull(c.ecartPct),
    sens: c.sens,
    couleur: c.couleur,
  };
}

function versVagueRowDTO(v: VagueRapprochementRow): VagueRapprochementRowDTO {
  return {
    vaguePrevueId: v.vaguePrevueId,
    codePrevu: v.codePrevu,
    statut: v.statut as VagueRapprochementRowDTO["statut"],
    vagueReelleId: v.vagueReelleId,
    codeReel: v.codeReel,
    realisee: v.realisee,
    coutComplet: versComparaisonDTO(v.coutComplet),
    marge: versComparaisonDTO(v.marge),
    coutAuKg: versComparaisonDTO(v.coutAuKg),
  };
}

function mapVersRecord<T, U>(map: Map<number, T>, convertir: (v: T) => U): Record<number, U> {
  const out: Record<number, U> = {};
  for (const [k, v] of map) out[k] = convertir(v);
  return out;
}

function mapListeVersRecord<T, U>(map: Map<number, T[]>, convertir: (v: T) => U): Record<number, U[]> {
  const out: Record<number, U[]> = {};
  for (const [k, liste] of map) out[k] = liste.map(convertir);
  return out;
}

/** Convertit `RapprochementScenarioVue` (moteur, Decimal) en `RapprochementScenarioDTO` (Server -> Client). */
export function construireRapprochementDTO(
  vue: RapprochementScenarioVue,
  dateDebutPlan: string
): RapprochementScenarioDTO {
  return {
    horizonMois: vue.horizonMois,
    dateDebutPlan,
    moisDisponibles: vue.moisDisponibles,
    lignesParMois: mapListeVersRecord(vue.lignesParMois, versLigneDTO),
    totalMoisParMois: mapVersRecord(vue.totalMoisParMois, (a: AgregatMois) => versAgregatEcartDTO(a)),
    nonRapprocheParMois: mapListeVersRecord(vue.nonRapprocheParMois, versLigneDTO),
    cumuleGlobalParMois: mapVersRecord(vue.cumuleGlobalParMois, versAgregatEcartDTO),
    cumuleParPosteParMois: mapListeVersRecord(vue.cumuleParPosteParMois, versAgregatPosteDTO),
    topEcartsParMois: mapListeVersRecord(vue.topEcartsParMois, versLigneDTO),
    vagues: vue.vagues.map(versVagueRowDTO),
    calculeLe: vue.calculeLe.toISOString(),
  };
}
