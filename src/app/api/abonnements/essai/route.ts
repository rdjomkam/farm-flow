/**
 * src/app/api/abonnements/essai/route.ts
 *
 * POST /api/abonnements/essai — Creer un abonnement essai gratuit
 *
 * Story 49.1 — Sprint 49
 *
 * Regles :
 * - Verifie que l'utilisateur n'a pas deja utilise un essai pour ce plan (EssaiUtilise)
 * - Si essai deja utilise : 409
 * - Tout dans une $transaction atomique : check EssaiUtilise → create Abonnement → create EssaiUtilise (R4 / ERR-016)
 * - Statut ACTIF directement (pas de paiement)
 * - dateFin = dateDebut + dureeEssaiJours (depuis le plan)
 * - logAbonnementAudit avec action "CREATION_ESSAI"
 * - invalidateSubscriptionCaches apres creation
 *
 * R2 : enums importes depuis @/types
 * R4 : check + creation atomiques via $transaction
 * R8 : siteId = auth.activeSiteId
 */
import { NextRequest, NextResponse } from "next/server";
import { logAbonnementAudit } from "@/lib/queries/abonnements";
import { getPlanAbonnementById } from "@/lib/queries/plans-abonnements";
import { requirePermission } from "@/lib/permissions";
import { invalidateSubscriptionCaches } from "@/lib/abonnements/invalidate-caches";
import { prisma } from "@/lib/db";
import { Permission, StatutAbonnement, TypePlan, PeriodeFacturation } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import type { TypePlan as TypePlanPrisma } from "@/generated/prisma/enums";

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ABONNEMENTS_GERER);
    const body = await request.json();

    // Validation du planId
    if (!body.planId || typeof body.planId !== "string") {
      return apiError(400, "Le planId est obligatoire.");
    }

    // Charger le plan
    const plan = await getPlanAbonnementById(body.planId);
    if (!plan || !plan.isActif) {
      return apiError(404, "Plan introuvable ou inactif.");
    }

    // Vérifier que le plan supporte les essais
    if (!plan.dureeEssaiJours || plan.dureeEssaiJours <= 0) {
      return apiError(400, "Ce plan ne propose pas d'essai gratuit.");
    }

    const dureeEssaiJours = plan.dureeEssaiJours;
    const typePlan = plan.typePlan as TypePlan;

    // Calcul des dates
    const dateDebut = new Date();
    const dateFin = new Date(dateDebut);
    dateFin.setDate(dateFin.getDate() + dureeEssaiJours);

    // R4 / ERR-016 : check EssaiUtilise + create Abonnement + create EssaiUtilise dans UNE SEULE $transaction
    let abonnement: Awaited<ReturnType<typeof prisma.abonnement.create>>;
    try {
      abonnement = await prisma.$transaction(async (tx) => {
        // Vérifier que l'essai n'a pas déjà été utilisé (unique par userId + typePlan)
        const essaiExistant = await tx.essaiUtilise.findUnique({
          where: {
            userId_typePlan: {
              userId: auth.userId,
              typePlan: typePlan as unknown as TypePlanPrisma,
            },
          },
        });
        if (essaiExistant) {
          throw new Error("ESSAI_DEJA_UTILISE");
        }

        // Créer l'abonnement essai en statut ACTIF directement (pas de paiement)
        // Sprint 52 : siteId supprimé de l'abonnement (user-level)
        const newAbonnement = await tx.abonnement.create({
          data: {
            planId: plan.id,
            // Pour un essai, la période est MENSUEL par défaut (dureeEssaiJours prévaut sur dateFin)
            periode: (body.periode as PeriodeFacturation) ?? PeriodeFacturation.MENSUEL,
            statut: StatutAbonnement.ACTIF,
            dateDebut,
            dateFin,
            dateProchainRenouvellement: dateFin,
            prixPaye: 0,
            userId: auth.userId,
            isEssai: true,
            dureeEssaiJours,
          },
        });

        // Marquer l'essai comme utilisé (contrainte @@unique garantit l'atomicité)
        await tx.essaiUtilise.create({
          data: {
            userId: auth.userId,
            typePlan: typePlan as unknown as TypePlanPrisma,
          },
        });

        return newAbonnement;
      });
    } catch (txError) {
      if (txError instanceof Error && txError.message === "ESSAI_DEJA_UTILISE") {
        return NextResponse.json(
          {
            status: 409,
            message: `Vous avez deja utilise votre essai gratuit pour le plan ${typePlan}. Un seul essai est autorise par plan.`,
          },
          { status: 409 }
        );
      }
      throw txError;
    }

    // Journaliser la création de l'essai (fire-and-forget)
    logAbonnementAudit(abonnement.id, "CREATION_ESSAI", auth.userId, {
      planId: plan.id,
      typePlan,
      dureeEssaiJours,
      dateFin: dateFin.toISOString(),
    }).catch((err) => {
      console.error("[abonnements/essai] Erreur logAbonnementAudit (ignoree) :", err);
    });

    // Invalider le cache d'abonnement (user-level + tous ses sites)
    await invalidateSubscriptionCaches(auth.userId);

    return NextResponse.json(
      {
        abonnement,
        message: `Essai gratuit de ${dureeEssaiJours} jours active avec succes.`,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError("POST /api/abonnements/essai", error, "Erreur serveur lors de la creation de l'essai.");
  }
}
