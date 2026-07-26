/**
 * Query layer — EcartAssignationConstate (ADR-048, Sprint SU, story SU.2).
 *
 * Expose la question « quels bacs dérivent aujourd'hui et de quelle
 * amplitude » à partir de l'état persisté par
 * `persisterEcartConstate` (src/lib/guards/assignation-invariant.ts).
 *
 * R4 : lecture seule, une seule requête (pas de N+1) grâce aux `include`
 * Prisma. R8 : filtre `siteId` obligatoire.
 */

import { prisma } from "@/lib/db";
import type { BacEnDerive, ContexteDetectionEcart } from "@/types";

/**
 * Retourne les bacs actuellement en dérive (écart non résolu, ecart !== 0)
 * pour un site donné, triés par détection la plus récente en premier.
 *
 * @param siteId - Identifiant du site (filtre multi-tenant R8).
 */
export async function getBacsEnDerive(siteId: string): Promise<BacEnDerive[]> {
  const ecarts = await prisma.ecartAssignationConstate.findMany({
    where: { siteId, ecart: { not: 0 } },
    include: {
      bac: { select: { nom: true } },
      vague: { select: { code: true } },
    },
    orderBy: { derniereDetectionLe: "desc" },
  });

  return ecarts.map((e) => ({
    bacId: e.bacId,
    bacNom: e.bac.nom,
    vagueId: e.vagueId,
    vagueCode: e.vague.code,
    ecart: e.ecart,
    premiereDetectionLe: e.premiereDetectionLe,
    derniereDetectionLe: e.derniereDetectionLe,
    dernierContexte: e.dernierContexte as ContexteDetectionEcart,
  }));
}
