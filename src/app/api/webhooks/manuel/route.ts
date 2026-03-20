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
import { prisma } from "@/lib/db";
import { Permission, StatutPaiementAbo } from "@/types";
import {
  confirmerPaiement,
  getPaiementByReference,
} from "@/lib/queries/paiements-abonnements";
import { activerAbonnement } from "@/lib/queries/abonnements";

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
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
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
    return NextResponse.json(
      { error: "Corps de requête JSON invalide" },
      { status: 400 }
    );
  }

  const { referenceExterne, abonnementId } = body;

  // Validation des champs obligatoires
  if (!referenceExterne || !abonnementId) {
    return NextResponse.json(
      { error: "referenceExterne et abonnementId sont obligatoires" },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: "Paiement introuvable pour cette référence" },
      { status: 404 }
    );
  }

  // Confirmation + activation : R4 via fonctions de query updateMany
  try {
    await confirmerPaiement(referenceExterne);
    await activerAbonnement(abonnementId);

    return NextResponse.json(
      {
        received: true,
        message: "Paiement confirmé et abonnement activé",
        confirméPar: auth.userId,
      },
      { status: 200 }
    );
  } catch (dbError) {
    console.error(
      "[webhook/manuel] Erreur :",
      dbError instanceof Error ? dbError.message : "Erreur inconnue"
    );
    return NextResponse.json(
      { error: "Erreur lors de la confirmation" },
      { status: 500 }
    );
  }
}
