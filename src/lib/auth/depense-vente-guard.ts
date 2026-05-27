import { StatutVente, Permission } from "@/types";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-utils";

type GuardResult =
  | { vente: { id: string; statut: StatutVente } }
  | Response;

/**
 * Verifie qu'une depense peut etre ajoutee ou modifiee pour une vente donnee.
 *
 * Regles :
 * - CLOTUREE : requiert la permission DEPENSES_VENTE_RETRO (403 sinon)
 * - EN_PREPARATION, LIVREE : DEPENSES_CREER suffit (pas de check ici, deja gere par requirePermission)
 *
 * Retourne `{ vente }` si OK, ou une `Response` d'erreur prete a etre renvoyee.
 */
export async function guardDepenseVente(
  venteId: string,
  siteId: string,
  userPermissions: string[]
): Promise<GuardResult> {
  const vente = await prisma.vente.findFirst({
    where: { id: venteId, siteId },
    select: { id: true, statut: true },
  });

  if (!vente) {
    return apiError(404, "Vente introuvable");
  }

  if (
    vente.statut === StatutVente.CLOTUREE &&
    !userPermissions.includes(Permission.DEPENSES_VENTE_RETRO)
  ) {
    return apiError(
      403,
      "Permission insuffisante pour modifier les depenses d'une vente cloturee. La permission DEPENSES_VENTE_RETRO est requise."
    );
  }

  return { vente: { id: vente.id, statut: vente.statut as StatutVente } };
}

/**
 * Retourne true si le resultat est une Response d'erreur, false si c'est
 * un objet { vente }.
 */
export function isGuardError(result: GuardResult): result is Response {
  return result instanceof Response;
}
