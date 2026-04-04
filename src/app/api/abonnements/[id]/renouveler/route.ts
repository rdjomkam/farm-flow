/**
 * src/app/api/abonnements/[id]/renouveler/route.ts
 *
 * POST /api/abonnements/[id]/renouveler — renouveler un abonnement expiré ou en grâce
 *
 * Story 32.2 — Sprint 32
 * R2 : enums importés depuis @/types
 * R4 : transitions de statut atomiques
 * R8 : siteId = auth.activeSiteId
 */
import { NextRequest, NextResponse } from "next/server";
import { getAbonnementById, createAbonnement } from "@/lib/queries/abonnements";
import { getPlanAbonnementById } from "@/lib/queries/plans-abonnements";
import { initierPaiement } from "@/lib/services/billing";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { invalidateSubscriptionCaches } from "@/lib/abonnements/invalidate-caches";
import { AuthError } from "@/lib/auth";
import {
  Permission,
  StatutAbonnement,
  PeriodeFacturation,
  FournisseurPaiement,
} from "@/types";
import { apiError } from "@/lib/api-utils";
import {
  PLAN_TARIFS,
  calculerProchaineDate,
} from "@/lib/abonnements-constants";
import type { CreateAbonnementDTO } from "@/types";

const VALID_FOURNISSEURS = Object.values(FournisseurPaiement);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.ABONNEMENTS_GERER);

    // Charger l'abonnement existant — R8 : siteId obligatoire
    const abonnement = await getAbonnementById(id, auth.activeSiteId);
    if (!abonnement) {
      return apiError(404, "Abonnement introuvable.");
    }

    // Vérifier que l'abonnement peut être renouvelé
    const statutsRenouvellables: string[] = [
      StatutAbonnement.EXPIRE,
      StatutAbonnement.EN_GRACE,
      StatutAbonnement.SUSPENDU,
      StatutAbonnement.ANNULE,
    ];
    if (!statutsRenouvellables.includes(abonnement.statut as string)) {
      return NextResponse.json(
        {
          status: 400,
          message: "Cet abonnement ne peut pas etre renouvel\u00e9. Statut actuel : " + abonnement.statut,
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validation du fournisseur (obligatoire pour le paiement)
    if (!body.fournisseur || !VALID_FOURNISSEURS.includes(body.fournisseur as FournisseurPaiement)) {
      return NextResponse.json(
        {
          status: 400,
          message: `Le fournisseur de paiement est obligatoire. Valeurs acceptees : ${VALID_FOURNISSEURS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Charger le plan actuel
    const plan = await getPlanAbonnementById(abonnement.planId);
    if (!plan || !plan.isActif) {
      return apiError(404, "Plan de l'abonnement introuvable ou inactif.");
    }

    // Calculer le nouveau prix et les nouvelles dates
    const periode = abonnement.periode as PeriodeFacturation;
    const tarifsType = PLAN_TARIFS[plan.typePlan as keyof typeof PLAN_TARIFS];
    const prixFinal = (tarifsType?.[periode] ?? 0) as number;

    const dateDebut = new Date();
    const dateFin = calculerProchaineDate(dateDebut, periode);
    const dateProchainRenouvellement = dateFin;

    // Créer un nouvel abonnement (renouvellement = nouvel abonnement lié au même plan)
    const data: CreateAbonnementDTO = {
      planId: abonnement.planId,
      periode,
      fournisseur: body.fournisseur as FournisseurPaiement,
      phoneNumber: body.phoneNumber,
    };

    const nouvelAbonnement = await createAbonnement(
      auth.activeSiteId,
      auth.userId,
      data,
      dateDebut,
      dateFin,
      dateProchainRenouvellement,
      prixFinal
    );

    // Initier le paiement pour le renouvellement
    const paiement = await initierPaiement(
      nouvelAbonnement.id,
      auth.userId,
      auth.activeSiteId,
      {
        abonnementId: nouvelAbonnement.id,
        phoneNumber: body.phoneNumber,
        fournisseur: body.fournisseur as FournisseurPaiement,
      }
    );

    // Invalider le cache d'abonnement (user-level + tous ses sites)
    await invalidateSubscriptionCaches(auth.userId);

    return NextResponse.json(
      {
        abonnement: nouvelAbonnement,
        paiement: {
          paiementId: paiement.paiementId,
          referenceExterne: paiement.referenceExterne,
          statut: paiement.statut,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    return NextResponse.json(
      { status: 500, message: `Erreur serveur lors du renouvellement. ${message}` },
      { status: 500 }
    );
  }
}
