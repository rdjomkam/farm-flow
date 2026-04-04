/**
 * src/app/api/backoffice/exonerations/[id]/route.ts
 *
 * GET    /api/backoffice/exonerations/[id] — détails d'une exonération
 * DELETE /api/backoffice/exonerations/[id] — annule une exonération (statut → ANNULE)
 *
 * Guard : requireSuperAdmin (ADR-022)
 *
 * DELETE — logique :
 *   1. Vérifie que l'abonnement existe et que plan.typePlan = EXONERATION
 *      (sécurité : ne pas annuler un abonnement normal par erreur)
 *   2. R4 : updateMany atomique avec condition motifExoneration IS NOT NULL
 *   3. Enregistre un audit "ANNULATION_EXONERATION"
 *   4. Invalide les caches subscription
 *
 * R2 : enums importés depuis @/types
 * R4 : updateMany conditionnel (atomique)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-utils";
import { TypePlan, StatutAbonnement } from "@/types";
import { logAbonnementAudit } from "@/lib/queries/abonnements";
import { invalidateSubscriptionCaches } from "@/lib/abonnements/invalidate-caches";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireSuperAdmin(request);
    const { id } = await context.params;

    const abonnement = await prisma.abonnement.findFirst({
      where: {
        id,
        plan: { typePlan: TypePlan.EXONERATION },
      },
      include: {
        plan: { select: { id: true, nom: true, typePlan: true } },
        site: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!abonnement) {
      return apiError(404, "Exoneration introuvable.");
    }

    return NextResponse.json(abonnement);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation de l'exoneration.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const adminSession = await requireSuperAdmin(request);
    const { id } = await context.params;

    // Vérifier que l'abonnement existe et est bien une exonération
    const abonnement = await prisma.abonnement.findFirst({
      where: {
        id,
        plan: { typePlan: TypePlan.EXONERATION },
        // Double guard : motifExoneration NOT NULL (ne pas annuler un abo normal)
        motifExoneration: { not: null },
      },
      select: {
        id: true,
        userId: true,
        statut: true,
        motifExoneration: true,
      },
    });

    if (!abonnement) {
      return apiError(404, "Exoneration introuvable ou deja annulee.");
    }

    if ((abonnement.statut as string) === StatutAbonnement.ANNULE) {
      return apiError(409, "Cette exoneration est deja annulee.");
    }

    // R4 : updateMany atomique avec condition — ne met à jour que si statut != ANNULE
    // et motifExoneration IS NOT NULL (garde double contre annulation d'abonnement normal)
    await prisma.abonnement.updateMany({
      where: {
        id,
        motifExoneration: { not: null },
        statut: { not: StatutAbonnement.ANNULE },
      },
      data: {
        statut: StatutAbonnement.ANNULE,
      },
    });

    // Audit hors transaction (non-critique)
    await logAbonnementAudit(id, "ANNULATION_EXONERATION", adminSession.userId, {
      motifOriginal: abonnement.motifExoneration,
      annulePar: adminSession.userId,
    }).catch(() => {});

    // Invalider les caches subscription
    await invalidateSubscriptionCaches(abonnement.userId).catch(() => {});

    return NextResponse.json({ success: true, message: "Exoneration annulee avec succes." });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de l'annulation de l'exoneration.");
  }
}
