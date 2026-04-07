/**
 * src/app/api/abonnements/[id]/paiements/route.ts
 *
 * GET  /api/abonnements/[id]/paiements — historique des paiements de cet abonnement
 * POST /api/abonnements/[id]/paiements — initier un nouveau paiement (cas paiement échoué)
 *
 * Story 32.3 — Sprint 32
 * R2 : enums importés depuis @/types
 * R8 : siteId = auth.activeSiteId
 */
import { NextRequest, NextResponse } from "next/server";
import { getAbonnementById } from "@/lib/queries/abonnements";
import { getPaiementsByAbonnement } from "@/lib/queries/paiements-abonnements";
import { initierPaiement } from "@/lib/services/billing";
import { requirePermission } from "@/lib/permissions";
import { Permission, FournisseurPaiement } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

const VALID_FOURNISSEURS = Object.values(FournisseurPaiement);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.ABONNEMENTS_VOIR);

    // Sprint 52 : ownership via userId (Decision 3)
    const abonnement = await getAbonnementById(id);
    if (!abonnement) {
      return apiError(404, "Abonnement introuvable.");
    }
    if (abonnement.userId !== auth.userId) {
      return apiError(403, "Accès refusé : cet abonnement n'appartient pas à votre compte.");
    }

    // Récupérer l'historique des paiements (ordonnés par date DESC dans la query)
    const paiements = await getPaiementsByAbonnement(id);
    return NextResponse.json({ paiements, total: paiements.length });
  } catch (error) {
    return handleApiError("GET /api/abonnements/[id]/paiements", error, "Erreur serveur lors de la recuperation des paiements.");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.ABONNEMENTS_GERER);

    // Sprint 52 : ownership via userId (Decision 3)
    const abonnement = await getAbonnementById(id);
    if (!abonnement) {
      return apiError(404, "Abonnement introuvable.");
    }
    if (abonnement.userId !== auth.userId) {
      return apiError(403, "Accès refusé : cet abonnement n'appartient pas à votre compte.");
    }

    const body = await request.json();

    // Validation du fournisseur
    if (!body.fournisseur || !VALID_FOURNISSEURS.includes(body.fournisseur as FournisseurPaiement)) {
      return NextResponse.json(
        {
          status: 400,
          message: `Le fournisseur de paiement est obligatoire. Valeurs acceptees : ${VALID_FOURNISSEURS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Initier un nouveau paiement (Sprint 52 : siteId supprimé de initierPaiement)
    // billing.initierPaiement gère l'idempotence : retourne le paiement en cours si existant
    const paiement = await initierPaiement(id, auth.userId, {
      abonnementId: id,
      phoneNumber: body.phoneNumber,
      fournisseur: body.fournisseur as FournisseurPaiement,
    });

    return NextResponse.json(
      {
        paiementId: paiement.paiementId,
        referenceExterne: paiement.referenceExterne,
        statut: paiement.statut,
        message: paiement.message,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError("POST /api/abonnements/[id]/paiements", error, "Erreur serveur lors de l'initiation du paiement.");
  }
}
