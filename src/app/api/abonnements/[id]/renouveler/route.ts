/**
 * src/app/api/abonnements/[id]/renouveler/route.ts
 *
 * POST /api/abonnements/[id]/renouveler — renouveler un abonnement expiré ou en grâce
 *
 * Story 32.2 — Sprint 32
 * Story 47.2 — Sprint 47 : déduction soldeCredit atomique + logAbonnementAudit + fix R2
 * R2 : TypePlan importé pour accès PLAN_TARIFS — jamais as keyof typeof (ERR-031)
 * R4 : soldeCredit deduction + abonnement creation dans la même $transaction (ERR-016)
 * R8 : siteId = auth.activeSiteId
 */
import { NextRequest, NextResponse } from "next/server";
import { getAbonnementById, logAbonnementAudit } from "@/lib/queries/abonnements";
import { getPlanAbonnementById } from "@/lib/queries/plans-abonnements";
import { initierPaiement } from "@/lib/services/billing";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { invalidateSubscriptionCaches } from "@/lib/abonnements/invalidate-caches";
import { AuthError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Permission,
  StatutAbonnement,
  PeriodeFacturation,
  FournisseurPaiement,
  TypePlan,
} from "@/types";
import { apiError } from "@/lib/api-utils";
import {
  PLAN_TARIFS,
  calculerProchaineDate,
} from "@/lib/abonnements-constants";

const VALID_FOURNISSEURS = Object.values(FournisseurPaiement);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.ABONNEMENTS_GERER);

    // Charger l'abonnement — Sprint 52 : ownership via userId (Decision 3)
    const abonnement = await getAbonnementById(id);
    if (!abonnement) {
      return apiError(404, "Abonnement introuvable.");
    }
    if (abonnement.userId !== auth.userId) {
      return apiError(403, "Accès refusé : cet abonnement n'appartient pas à votre compte.");
    }

    // Vérifier que l'abonnement peut être renouvelé
    const statutsRenouvellables: StatutAbonnement[] = [
      StatutAbonnement.EXPIRE,
      StatutAbonnement.EN_GRACE,
      StatutAbonnement.SUSPENDU,
      StatutAbonnement.ANNULE,
    ];
    if (!statutsRenouvellables.includes(abonnement.statut as StatutAbonnement)) {
      return NextResponse.json(
        {
          status: 400,
          message:
            "Cet abonnement ne peut pas etre renouvel\u00e9. Statut actuel : " +
            abonnement.statut,
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validation du fournisseur (obligatoire pour le paiement)
    if (
      !body.fournisseur ||
      !VALID_FOURNISSEURS.includes(body.fournisseur as FournisseurPaiement)
    ) {
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

    // Calculer le prix de base selon la période
    // R2/ERR-031 : cast as TypePlan, jamais as keyof typeof PLAN_TARIFS
    const periode = abonnement.periode as PeriodeFacturation;
    const tarifsType = PLAN_TARIFS[plan.typePlan as TypePlan];
    const prixPlan = (tarifsType?.[periode] ?? 0) as number;

    const dateDebut = new Date();
    const dateFin = calculerProchaineDate(dateDebut, periode);
    const dateProchainRenouvellement = dateFin;

    // Déduire le soldeCredit atomiquement avec la création de l'abonnement (R4 / ERR-016)
    // Si la transaction échoue, le crédit n'est pas consommé.
    const { nouvelAbonnement, soldeCrediteUtilise, prixFinal } =
      await prisma.$transaction(async (tx) => {
        // Lire le solde actuel
        const user = await tx.user.findUniqueOrThrow({
          where: { id: auth.userId },
          select: { soldeCredit: true },
        });
        const soldeCredit = Number(user.soldeCredit);

        // Calculer les montants
        const crediteUtilise = Math.min(soldeCredit, prixPlan);
        const prixApresCredit = Math.max(0, prixPlan - soldeCredit);
        const nouveauSolde = Math.max(0, soldeCredit - prixPlan);

        // Mettre à jour le soldeCredit si une déduction est nécessaire
        if (crediteUtilise > 0) {
          await tx.user.update({
            where: { id: auth.userId },
            data: { soldeCredit: nouveauSolde },
          });
        }

        // Créer le nouvel abonnement avec le prix après déduction du crédit
        // Sprint 52 : siteId supprimé de l'abonnement (user-level)
        const createdAbonnement = await tx.abonnement.create({
          data: {
            planId: abonnement.planId,
            periode,
            statut: StatutAbonnement.EN_ATTENTE_PAIEMENT,
            dateDebut,
            dateFin,
            dateProchainRenouvellement,
            prixPaye: prixApresCredit,
            userId: auth.userId,
          },
        });

        return {
          nouvelAbonnement: createdAbonnement,
          soldeCrediteUtilise: crediteUtilise,
          prixFinal: prixApresCredit,
        };
      });

    // Journaliser le renouvellement (fire-and-forget)
    logAbonnementAudit(nouvelAbonnement.id, "RENOUVELLEMENT", auth.userId, {
      abonnementPrecedentId: abonnement.id,
      soldeCrediteUtilise,
      prixFinal,
    }).catch((err) => {
      console.error("[renouveler] Erreur logAbonnementAudit (ignorée) :", err);
    });

    // Initier le paiement pour le renouvellement (Sprint 52 : siteId supprimé)
    const paiement = await initierPaiement(
      nouvelAbonnement.id,
      auth.userId,
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
