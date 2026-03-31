/**
 * src/app/api/abonnements/[id]/annuler/route.ts
 *
 * POST /api/abonnements/[id]/annuler — annuler un abonnement
 *
 * Story 32.2 — Sprint 32
 * R2 : enums importés depuis @/types
 * R4 : updateMany atomique avec condition pour la transition de statut
 * R8 : siteId = auth.activeSiteId
 *
 * Note : L'annulation prend effet à la date d'expiration (pas de remboursement).
 * `annulerAbonnement` n'existe pas dans les queries — implémentée ici via prisma direct
 * avec updateMany R4-atomique.
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAbonnementById } from "@/lib/queries/abonnements";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { Permission, StatutAbonnement } from "@/types";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.ABONNEMENTS_GERER);

    // Vérifier l'appartenance au site actif — R8
    const abonnement = await getAbonnementById(id, auth.activeSiteId);
    if (!abonnement) {
      return apiError(404, "Abonnement introuvable.");
    }

    // Ne pas ré-annuler ou ré-annuler un abonnement déjà terminé
    const statutsNonAnnulables: string[] = [
      StatutAbonnement.ANNULE,
      StatutAbonnement.EXPIRE,
    ];
    if (statutsNonAnnulables.includes(abonnement.statut as string)) {
      return NextResponse.json(
        {
          status: 400,
          message: "Cet abonnement est d\u00e9j\u00e0 annul\u00e9 ou expir\u00e9.",
        },
        { status: 400 }
      );
    }

    // R4 : updateMany atomique avec condition — ne met à jour que les statuts valides
    // ERR-008 : comparaison via string cast pour éviter le conflit enum Prisma vs TypeScript
    const result = await prisma.abonnement.updateMany({
      where: {
        id,
        siteId: auth.activeSiteId,
        statut: {
          notIn: [
            StatutAbonnement.ANNULE as never,
            StatutAbonnement.EXPIRE as never,
          ],
        },
      },
      data: {
        statut: StatutAbonnement.ANNULE as never,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        {
          status: 400,
          message: "Impossible d'annuler cet abonnement.",
        },
        { status: 400 }
      );
    }

    // Invalider le cache d'abonnement du site
    revalidateTag(`subscription-${auth.activeSiteId}`, {});

    return NextResponse.json({
      message: "Abonnement annul\u00e9. Il restera actif jusqu'\u00e0 la date d'expiration.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de l'annulation.");
  }
}
