/**
 * src/app/api/webhooks/manuel/route.ts
 *
 * Route de confirmation manuelle d'un paiement — réservée aux admins DKFarm.
 *
 * Authentifiée (contrairement au webhook Smobilpay automatique).
 * Permet à un admin de confirmer un paiement sans callback automatique.
 *
 * Story 31.3 — Sprint 31
 *
 * R2 : Utiliser StatutPaiementAbo.CONFIRME depuis "@/types"
 * R4 : confirmerPaiement + activerAbonnement via fonctions de query (updateMany)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { invalidateSubscriptionCaches } from "@/lib/abonnements/invalidate-caches";
import { prisma } from "@/lib/db";
import { Permission, StatutPaiementAbo } from "@/types";
import {
  confirmerPaiement,
  getPaiementByReference,
} from "@/lib/queries/paiements-abonnements";
import { apiError, handleApiError } from "@/lib/api-utils";
import { activerAbonnement } from "@/lib/queries/abonnements";
import { applyPlanModules } from "@/lib/abonnements/apply-plan-modules";

// ---------------------------------------------------------------------------
// POST /api/webhooks/manuel
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Authentification + permission ABONNEMENTS_GERER
  let auth;
  try {
    auth = await requirePermission(request, Permission.ABONNEMENTS_GERER);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(401, "Non authentifié");
  }

  // Lire le corps de la requête
  let body: { referenceExterne: string; abonnementId: string; notes?: string };
  try {
    body = (await request.json()) as {
      referenceExterne: string;
      abonnementId: string;
      notes?: string;
    };
  } catch {
    return apiError(400, "Corps de requête JSON invalide");
  }

  const { referenceExterne, abonnementId } = body;

  // Validation des champs obligatoires
  if (!referenceExterne || !abonnementId) {
    return apiError(400, "referenceExterne et abonnementId sont obligatoires");
  }

  // Vérifier l'idempotence via les fonctions de query Sprint 30
  const paiementExistant = await getPaiementByReference(referenceExterne);

  if ((paiementExistant?.statut as string) === StatutPaiementAbo.CONFIRME) {
    return NextResponse.json(
      { received: true, message: "Paiement déjà confirmé (idempotent)" },
      { status: 200 }
    );
  }

  if (!paiementExistant) {
    return apiError(404, "Paiement introuvable pour cette référence");
  }

  // Confirmation + activation : R4 via fonctions de query updateMany
  try {
    await confirmerPaiement(referenceExterne);
    await activerAbonnement(abonnementId);

    // Story 43.5 : appliquer les modules du plan au site
    // Récupère l'abonnement pour obtenir planId et userId
    // Sprint 52 (Decision 4) : siteId supprimé — résolution via userId → site.ownerId
    const abonnement = await prisma.abonnement.findUnique({
      where: { id: abonnementId },
      select: { planId: true, userId: true },
    });

    if (abonnement) {
      // Invalider le cache d'abonnement (user-level + tous ses sites)
      await invalidateSubscriptionCaches(abonnement.userId);

      // Fire-and-forget : ne pas bloquer la réponse si erreur module
      // Résoudre le siteId via le premier site actif de l'utilisateur
      prisma.site.findFirst({
        where: { ownerId: abonnement.userId },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      }).then((site) => {
        if (site) {
          return applyPlanModules(site.id, abonnement.planId);
        }
      }).catch((modulesError) => {
        console.error(
          "[webhook/manuel] Erreur applyPlanModules (non-bloquant) :",
          modulesError instanceof Error ? modulesError.message : "Erreur inconnue"
        );
      });
    }

    return NextResponse.json(
      {
        received: true,
        message: "Paiement confirmé et abonnement activé",
        confirméPar: auth.userId,
      },
      { status: 200 }
    );
  } catch (dbError) {
    return handleApiError("POST /api/webhooks/manuel", dbError, "Erreur lors de la confirmation.");
  }
}
