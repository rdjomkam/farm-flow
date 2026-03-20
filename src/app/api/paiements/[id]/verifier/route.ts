/**
 * src/app/api/paiements/[id]/verifier/route.ts
 *
 * GET /api/paiements/[id]/verifier — vérifier le statut d'un paiement via la gateway
 *
 * Story 32.3 — Sprint 32
 * R2 : enums importés depuis @/types
 * R8 : siteId = auth.activeSiteId (vérification de sécurité)
 *
 * Idempotence : vérifier ne déclenche jamais d'actions irréversibles sans confirmation gateway.
 * Le polling s'arrête côté client après 10 tentatives (50s).
 */
import { NextRequest, NextResponse } from "next/server";
import { getPaiementsByAbonnement } from "@/lib/queries/paiements-abonnements";
import { verifierEtActiverPaiement } from "@/lib/services/billing";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { Permission, StatutPaiementAbo } from "@/types";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.ABONNEMENTS_VOIR);

    // Charger le paiement en DB pour vérifier l'appartenance au site actif — R8
    const paiement = await prisma.paiementAbonnement.findFirst({
      where: {
        id,
        siteId: auth.activeSiteId,
      },
      include: {
        abonnement: {
          select: { id: true, siteId: true, statut: true },
        },
      },
    });

    if (!paiement) {
      return NextResponse.json(
        { status: 404, message: "Paiement introuvable." },
        { status: 404 }
      );
    }

    // Si pas de référence externe, on ne peut pas vérifier auprès de la gateway
    if (!paiement.referenceExterne) {
      return NextResponse.json({
        paiementId: paiement.id,
        statut: paiement.statut,
        confirme: false,
        message: "Aucune reference externe disponible pour la verification.",
      });
    }

    // Vérifier auprès de la gateway et activer l'abonnement si confirmé
    // Idempotent : verifierEtActiverPaiement gère le cas "déjà confirmé"
    const confirme = await verifierEtActiverPaiement(paiement.referenceExterne);

    // Recharger le statut après vérification
    const paiementMisAJour = await prisma.paiementAbonnement.findFirst({
      where: { id },
      select: { statut: true, dateConfirmation: true },
    });

    return NextResponse.json({
      paiementId: paiement.id,
      statut: paiementMisAJour?.statut ?? paiement.statut,
      confirme,
      dateConfirmation: paiementMisAJour?.dateConfirmation ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la verification du paiement." },
      { status: 500 }
    );
  }
}
