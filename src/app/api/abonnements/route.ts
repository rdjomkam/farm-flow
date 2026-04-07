/**
 * src/app/api/abonnements/route.ts
 *
 * GET  /api/abonnements   — liste des abonnements du site actif (auth + ABONNEMENTS_VOIR)
 * POST /api/abonnements   — souscrire à un plan (auth + ABONNEMENTS_GERER)
 *
 * Story 32.2 — Sprint 32
 * Story 47.2 — Sprint 47 : garde-fou 409 EN_ATTENTE_PAIEMENT + logAbonnementAudit
 * R2 : enums importés depuis @/types — TypePlan pour accès PLAN_TARIFS (ERR-031)
 * R4 : garde-fou + création dans la même $transaction (ERR-016)
 * R8 : siteId = auth.activeSiteId sur toutes les queries
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getAbonnements,
  logAbonnementAudit,
} from "@/lib/queries/abonnements";
import { apiError, handleApiError } from "@/lib/api-utils";
import { getPlanAbonnementById } from "@/lib/queries/plans-abonnements";
import {
  verifierRemiseApplicable,
  appliquerRemise,
} from "@/lib/queries/remises";
import { initierPaiement } from "@/lib/services/billing";
import { verifierEtAppliquerRemiseAutomatique } from "@/lib/services/remises-automatiques";
import { requirePermission } from "@/lib/permissions";
import { invalidateSubscriptionCaches } from "@/lib/abonnements/invalidate-caches";
import { prisma } from "@/lib/db";
import {
  Permission,
  StatutAbonnement,
  PeriodeFacturation,
  FournisseurPaiement,
  TypePlan,
} from "@/types";
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

    // Sprint 52 : getAbonnements par userId (user-level)
    const abonnements = await getAbonnements(auth.userId, filters);
    return NextResponse.json({ abonnements, total: abonnements.length });
  } catch (error) {
    return handleApiError("GET /api/abonnements", error, "Erreur serveur lors de la recuperation des abonnements.");
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
    // R2/ERR-031 : cast as TypePlan, jamais as keyof typeof PLAN_TARIFS
    const tarifsType = PLAN_TARIFS[plan.typePlan as TypePlan];
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

    const data: CreateAbonnementDTO = {
      planId: body.planId,
      periode: body.periode as PeriodeFacturation,
      phoneNumber: body.phoneNumber,
      fournisseur: body.fournisseur as FournisseurPaiement,
      remiseCode: body.remiseCode,
    };

    // Garde-fou 409 + création atomique (R4 / ERR-016)
    // Vérifier l'absence d'EN_ATTENTE_PAIEMENT ET créer dans la même $transaction.
    let abonnement: Awaited<ReturnType<typeof prisma.abonnement.create>>;
    try {
      abonnement = await prisma.$transaction(async (tx) => {
        // Garde-fou : un seul EN_ATTENTE_PAIEMENT autorisé par utilisateur
        const enAttente = await tx.abonnement.count({
          where: {
            userId: auth.userId,
            statut: StatutAbonnement.EN_ATTENTE_PAIEMENT,
          },
        });
        if (enAttente > 0) {
          throw new Error("EN_ATTENTE_PAIEMENT_EXISTE");
        }

        // Sprint 52 : siteId supprimé de l'abonnement (user-level)
        return tx.abonnement.create({
          data: {
            planId: data.planId,
            periode: data.periode,
            statut: StatutAbonnement.EN_ATTENTE_PAIEMENT,
            dateDebut,
            dateFin,
            dateProchainRenouvellement,
            prixPaye: prixFinal,
            userId: auth.userId,
          },
        });
      });
    } catch (txError) {
      if (txError instanceof Error && txError.message === "EN_ATTENTE_PAIEMENT_EXISTE") {
        return NextResponse.json(
          {
            status: 409,
            message:
              "Un changement de plan est deja en cours. Veuillez finaliser ou annuler le paiement en attente avant de souscrire un nouvel abonnement.",
          },
          { status: 409 }
        );
      }
      throw txError;
    }

    // Journaliser la création de l'abonnement (fire-and-forget — ne bloque pas la réponse)
    logAbonnementAudit(abonnement.id, "CREATION", auth.userId, {
      planId: data.planId,
      periode: data.periode,
      prixFinal,
    }).catch((err) => {
      console.error("[abonnements] Erreur logAbonnementAudit (ignorée) :", err);
    });

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

    // Initier le paiement (Sprint 52 : siteId supprimé de initierPaiement)
    const paiement = await initierPaiement(abonnement.id, auth.userId, {
      abonnementId: abonnement.id,
      phoneNumber: body.phoneNumber,
      fournisseur: body.fournisseur as FournisseurPaiement,
    });

    // Invalider le cache d'abonnement (user-level + tous ses sites)
    await invalidateSubscriptionCaches(auth.userId);

    return NextResponse.json(
      {
        abonnement,
        paiement: {
          referenceExterne: paiement.referenceExterne,
          statut: paiement.statut,
          paiementId: paiement.paiementId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError("POST /api/abonnements", error, "Erreur serveur lors de la souscription.");
  }
}
