/**
 * src/lib/abonnements/invalidate-caches.ts
 *
 * Helpers d'invalidation du cache Next.js pour les abonnements.
 *
 * Sprint 46 — Story 46.1
 * Invalide les tags :
 *   - `subscription-${userId}` (cache user-level)
 *   - `subscription-site-${siteId}` pour chaque site dont l'utilisateur est propriétaire
 */
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";

/**
 * Invalide tous les caches d'abonnement liés à un utilisateur.
 *
 * - Tag user-level : `subscription-${userId}`
 * - Tag site-level : `subscription-site-${siteId}` pour chaque site
 *   dont l'utilisateur est propriétaire (site.ownerId = userId)
 *
 * @param userId - ID de l'utilisateur propriétaire de l'abonnement
 */
export async function invalidateSubscriptionCaches(
  userId: string
): Promise<void> {
  // Invalider le cache user-level
  // Second argument {} satisfies CacheLifeConfig (Next.js 16+)
  revalidateTag(`subscription-${userId}`, {});

  // Charger tous les sites dont l'utilisateur est propriétaire
  const sites = await prisma.site.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });

  // Invalider le cache pour chaque site
  for (const site of sites) {
    revalidateTag(`subscription-site-${site.id}`, {});
  }
}
