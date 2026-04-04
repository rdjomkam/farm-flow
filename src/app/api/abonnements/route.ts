/**
 * src/app/api/abonnements/route.ts
 *
 * GET  /api/abonnements   — liste des abonnements du site actif (auth + ABONNEMENTS_VOIR)
 * POST /api/abonnements   — souscrire à un plan (auth + ABONNEMENTS_GERER)
 *
 * Story 32.2 — Sprint 32
 * R2 : enums importés depuis @/types
 * R4 : opérations atomiques via les fonctions query
 * R8 : siteId = auth.activeSiteId sur toutes les queries
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getAbonnements,
  createAbonnement,
} from "@/lib/queries/abonnements";
import { apiError } from "@/lib/api-utils";
import { getPlanAbonnementById } from "@/lib/queries/plans-abonnements";
import {
  verifierRemiseApplicable,
  appliquerRemise,
} from "@/lib/queries/remises";
import { initierPaiement } from "@/lib/services/billing";
import { verifierEtAppliquerRemiseAutomatique } from "@/lib/services/remises-automatiques";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { invalidateSubscriptionCaches } from "@/lib/abonnements/invalidate-caches";
import { AuthError } from "@/lib/auth";
import { Permission, StatutAbonnement, PeriodeFacturation, FournisseurPaiement } from "@/types";
import {
  PLAN_TARIFS,
  calculerMontantRemise,
  calculerProchaineDate,
} from "@/lib/abonnements-constants";
import type { CreateAbonnementDTO, AbonnementFilters } from "@/types";

const VALID_PERIODES = Object.values(PeriodeFacturation);
const VALID_FOURNISSEURS = Object.values(FournisseurPaiement);
const VALID_STATUTS = Object.values(StatutAbonnement);

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ABONNEMENTS_VOIR);
    const { searchParams } = new URL(request.url);

    const filters: AbonnementFilters = {};
    const statut = searchParams.get("statut");
    if (statut && VALID_STATUTS.includes(statut as StatutAbonnement)) {
      filters.statut = statut as StatutAbonnement;
    }
    const planId = searchParams.get("planId");
    if (planId) filters.planId = planId;
    const dateDebutAfter = searchParams.get("dateDebutAfter");
    if (dateDebutAfter) filters.dateDebutAfter = dateDebutAfter;
    const dateFinBefore = searchParams.get("dateFinBefore");
    if (dateFinBefore) filters.dateFinBefore = dateFinBefore;

    const abonnements = await getAbonnements(auth.activeSiteId, filters);
    return NextResponse.json({ abonnements, total: abonnements.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des abonnements.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ABONNEMENTS_GERER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validation du planId
    if (!body.planId || typeof body.planId !== "string") {
      errors.push({ field: "planId", message: "Le plan est obligatoire." });
    }

    // Validation de la période
    if (!body.periode || !VALID_PERIODES.includes(body.periode as PeriodeFacturation)) {
      errors.push({
        field: "periode",
        message: `La periode est obligatoire. Valeurs acceptees : ${VALID_PERIODES.join(", ")}`,
      });
    }

    // Validation du fournisseur
    if (!body.fournisseur || !VALID_FOURNISSEURS.includes(body.fournisseur as FournisseurPaiement)) {
      errors.push({
        field: "fournisseur",
        message: `Le fournisseur de paiement est obligatoire. Valeurs acceptees : ${VALID_FOURNISSEURS.join(", ")}`,
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    // Charger le plan
    const plan = await getPlanAbonnementById(body.planId);
    if (!plan || !plan.isActif) {
      return apiError(404, "Plan introuvable ou inactif.");
    }

    // Vérifier la remise si fournie
    let remise = null;
    if (body.remiseCode) {
      const result = await verifierRemiseApplicable(body.remiseCode, auth.activeSiteId);
      if (!result.remise) {
        return apiError(400, result.erreur ?? "Code promo invalide.");
      }
      remise = result.remise;
    }

    // Calculer le prix selon la période
    const tarifsType = PLAN_TARIFS[plan.typePlan as keyof typeof PLAN_TARIFS];
    const prixBase = tarifsType?.[body.periode as PeriodeFacturation] ?? 0;

    // Appliquer la remise si présente
    // ERR-008 : convertir l'objet Prisma en Remise TypeScript (Decimal → number, enums as cast)
    const prixFinal = remise
      ? calculerMontantRemise(prixBase as number, {
          id: remise.id,
          nom: remise.nom,
          code: remise.code,
          type: remise.type as import("@/types").TypeRemise,
          valeur: Number(remise.valeur),
          estPourcentage: remise.estPourcentage,
          dateDebut: remise.dateDebut,
          dateFin: remise.dateFin,
          limiteUtilisations: remise.limiteUtilisations,
          nombreUtilisations: remise.nombreUtilisations,
          isActif: remise.isActif,
          siteId: remise.siteId,
          userId: remise.userId,
          planId: remise.planId,
          createdAt: remise.createdAt,
          updatedAt: remise.updatedAt,
        })
      : (prixBase as number);

    // Calculer les dates
    const dateDebut = new Date();
    const dateFin = calculerProchaineDate(dateDebut, body.periode as PeriodeFacturation);
    const dateProchainRenouvellement = dateFin;

    // Créer l'abonnement
    const data: CreateAbonnementDTO = {
      planId: body.planId,
      periode: body.periode as PeriodeFacturation,
      phoneNumber: body.phoneNumber,
      fournisseur: body.fournisseur as FournisseurPaiement,
      remiseCode: body.remiseCode,
    };

    const abonnement = await createAbonnement(
      auth.activeSiteId,
      auth.userId,
      data,
      dateDebut,
      dateFin,
      dateProchainRenouvellement,
      prixFinal
    );

    // Appliquer la remise en DB si présente
    if (remise) {
      await appliquerRemise(remise.id, abonnement.id, auth.userId, prixBase as number - prixFinal);
    }

    // Appliquer la remise automatique Early Adopter si applicable (fire-and-forget)
    // Ne bloque pas la souscription en cas d'erreur
    verifierEtAppliquerRemiseAutomatique(
      auth.activeSiteId,
      abonnement.id,
      auth.userId
    ).catch((err) => {
      console.error("[abonnements] Erreur remise automatique (ignorée) :", err);
    });

    // Initier le paiement
    const paiement = await initierPaiement(abonnement.id, auth.userId, auth.activeSiteId, {
      abonnementId: abonnement.id,
      phoneNumber: body.phoneNumber,
      fournisseur: body.fournisseur as FournisseurPaiement,
    });

    // Invalider le cache d'abonnement (user-level + tous ses sites)
    await invalidateSubscriptionCaches(auth.userId);

    return NextResponse.json(
      { abonnement, paiement: { referenceExterne: paiement.referenceExterne, statut: paiement.statut, paiementId: paiement.paiementId } },
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
      { status: 500, message: `Erreur serveur lors de la souscription. ${message}` },
      { status: 500 }
    );
  }
}
