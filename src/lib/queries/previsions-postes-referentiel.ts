/**
 * src/lib/queries/previsions-postes-referentiel.ts
 *
 * Queries Prisma — `PosteReferentiel` (ADR-053 §16, story A.4).
 *
 * R8 : `siteId` filtre sur chaque lecture. Aucune route de creation/suppression directe n'est
 * livree par cette story — `PosteReferentiel` est peuple exclusivement par le get-or-create de
 * `createPostePrevision` (`src/lib/queries/previsions-charges.ts`).
 */
import { prisma } from "@/lib/db";

/**
 * Liste les entrees `PosteReferentiel` ACTIVES d'un site — consommee par
 * `mapping-form-dialog.tsx` (cibleType = POSTE_PREVISION) pour choisir un `cibleId` site-scope
 * a la place, desormais, du `PostePrevision.id` scenario-scope (la source du defaut ERR-179).
 */
export async function listerPostesReferentielActifs(siteId: string) {
  return prisma.posteReferentiel.findMany({
    where: { siteId, actif: true },
    orderBy: { libelle: "asc" },
  });
}
