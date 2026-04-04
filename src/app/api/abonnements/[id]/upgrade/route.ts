/**
 * src/app/api/abonnements/[id]/upgrade/route.ts
 *
 * POST /api/abonnements/[id]/upgrade — Upgrader un abonnement vers un plan supérieur
 *
 * Story 50.1 — Sprint 50
 * R2 : TypePlan, PeriodeFacturation, StatutAbonnement, FournisseurPaiement importés depuis @/types
 * R4 : annulation ancien + création nouveau + soldeCredit dans la même $transaction (ERR-016)
 * R8 : siteId = auth.activeSiteId
 *
 * Logique prorata :
 * - Calculer le crédit restant sur l'abonnement actuel
 * - Si crédit >= prix nouveau plan → upgrade immédiat gratuit, solde crédit mis à jour
 * - Si crédit < prix nouveau plan → initier paiement pour la différence
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
import {
  calculerCreditRestant,
  calculerDeltaUpgrade,
} from "@/lib/abonnements/prorata";

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

    // Vérifier que l'abonnement est actif ou en grâce
    const statutsUpgradables: string[] = [
      StatutAbonnement.ACTIF,
      StatutAbonnement.EN_GRACE,
    ];
    if (!statutsUpgradables.includes(abonnement.statut as string)) {
      return apiError(
        400,
        `Seuls les abonnements ACTIF ou EN_GRACE peuvent être upgradés. Statut actuel : ${abonnement.statut}`
      );
    }

    const body = await request.json();

    // Validation du corps de la requête (UpgradeDTO)
    if (!body.nouveauPlanId || typeof body.nouveauPlanId !== "string") {
      return apiError(400, "Le champ nouveauPlanId est obligatoire.");
    }

    const periodeValides = Object.values(PeriodeFacturation);
    const periode: PeriodeFacturation =
      body.periode && periodeValides.includes(body.periode as PeriodeFacturation)
        ? (body.periode as PeriodeFacturation)
        : (abonnement.periode as PeriodeFacturation);

    // Valider le fournisseur uniquement si un paiement sera nécessaire
    const fournisseur: FournisseurPaiement | undefined = body.fournisseur;
    if (fournisseur && !VALID_FOURNISSEURS.includes(fournisseur)) {
      return apiError(
        400,
        `Fournisseur invalide. Valeurs acceptées : ${VALID_FOURNISSEURS.join(", ")}`
      );
    }

    // Charger le plan actuel et le nouveau plan
    const [planActuel, nouveauPlan] = await Promise.all([
      getPlanAbonnementById(abonnement.planId),
      getPlanAbonnementById(body.nouveauPlanId),
    ]);

    if (!nouveauPlan || !nouveauPlan.isActif) {
      return apiError(404, "Nouveau plan introuvable ou inactif.");
    }

    if (nouveauPlan.id === abonnement.planId) {
      return apiError(400, "Le nouveau plan est identique au plan actuel.");
    }

    // Calculer le prix du nouveau plan
    // R2/ERR-031 : cast as TypePlan, jamais as keyof typeof PLAN_TARIFS
    const tarifsNouveauPlan = PLAN_TARIFS[nouveauPlan.typePlan as TypePlan];
    const prixNouveauPlan = (tarifsNouveauPlan?.[periode] ?? null) as number | null;

    if (prixNouveauPlan === null) {
      return apiError(
        400,
        `La période ${periode} n'est pas disponible pour le plan ${nouveauPlan.typePlan}.`
      );
    }

    // Calculer le crédit prorata restant sur l'abonnement actuel
    const aujourdhui = new Date();
    const creditProrata = calculerCreditRestant(
      Number(abonnement.prixPaye),
      abonnement.dateDebut,
      abonnement.dateFin,
      aujourdhui
    );

    // R4 : Lire le solde crédit et calculer le delta dans la transaction
    const result = await prisma.$transaction(async (tx) => {
      // Lire le solde crédit actuel de l'utilisateur
      const user = await tx.user.findUniqueOrThrow({
        where: { id: auth.userId },
        select: { soldeCredit: true },
      });
      const soldeCreditActuel = Number(user.soldeCredit);

      // Calculer le delta upgrade
      const delta = calculerDeltaUpgrade(
        creditProrata,
        prixNouveauPlan,
        soldeCreditActuel
      );

      const dateDebut = new Date();
      const dateFin = calculerProchaineDate(dateDebut, periode);
      const dateProchainRenouvellement = dateFin;

      if (delta.montantAPayer === 0) {
        // Upgrade immédiat : credit couvre le nouveau plan
        // R4 : annuler ancien + créer nouveau + mettre à jour soldeCredit atomiquement

        // 1. Annuler l'abonnement actuel
        await tx.abonnement.updateMany({
          where: { id: abonnement.id, statut: { in: [StatutAbonnement.ACTIF, StatutAbonnement.EN_GRACE] } },
          data: { statut: StatutAbonnement.ANNULE },
        });

        // 2. Mettre à jour le solde crédit (prorata + solde existant - prix nouveau plan)
        const nouveauSolde = delta.creditRestant;
        await tx.user.update({
          where: { id: auth.userId },
          data: { soldeCredit: nouveauSolde },
        });

        // 3. Créer le nouvel abonnement directement ACTIF (Sprint 52 : siteId supprimé)
        const nouvelAbonnement = await tx.abonnement.create({
          data: {
            planId: nouveauPlan.id,
            periode,
            statut: StatutAbonnement.ACTIF,
            dateDebut,
            dateFin,
            dateProchainRenouvellement,
            prixPaye: prixNouveauPlan,
            userId: auth.userId,
          },
        });

        return {
          type: "IMMEDIAT" as const,
          nouvelAbonnement,
          delta,
          nouveauSolde,
          paiement: null,
        };
      } else {
        // Paiement nécessaire : créer l'abonnement EN_ATTENTE_PAIEMENT
        // L'annulation de l'ancien aura lieu lors de la confirmation de paiement

        // Vérifier que le fournisseur est présent
        if (!fournisseur) {
          throw new Error(
            "FOURNISSEUR_REQUIS:Le fournisseur de paiement est obligatoire pour ce montant."
          );
        }

        // Créer le nouvel abonnement en attente de paiement (Sprint 52 : siteId supprimé)
        const nouvelAbonnement = await tx.abonnement.create({
          data: {
            planId: nouveauPlan.id,
            periode,
            statut: StatutAbonnement.EN_ATTENTE_PAIEMENT,
            dateDebut,
            dateFin,
            dateProchainRenouvellement,
            prixPaye: delta.montantAPayer,
            userId: auth.userId,
          },
        });

        return {
          type: "PAIEMENT_REQUIS" as const,
          nouvelAbonnement,
          delta,
          nouveauSolde: soldeCreditActuel,
          paiement: null,
        };
      }
    });

    // Journaliser l'upgrade (fire-and-forget)
    logAbonnementAudit(result.nouvelAbonnement.id, "UPGRADE", auth.userId, {
      abonnementPrecedentId: abonnement.id,
      ancienPlanId: abonnement.planId,
      ancienPlanNom: planActuel?.nom ?? null,
      nouveauPlanId: nouveauPlan.id,
      nouveauPlanNom: nouveauPlan.nom,
      creditProrata,
      montantAPaye: result.delta.montantAPayer,
      creditRestant: result.delta.creditRestant,
      upgradeImmédiat: result.type === "IMMEDIAT",
    }).catch((err) => {
      console.error("[upgrade] Erreur logAbonnementAudit (ignorée) :", err);
    });

    // Si paiement requis : initier le paiement
    let paiementResult = null;
    if (result.type === "PAIEMENT_REQUIS") {
      // Sprint 52 : siteId supprimé de initierPaiement
      paiementResult = await initierPaiement(
        result.nouvelAbonnement.id,
        auth.userId,
        {
          abonnementId: result.nouvelAbonnement.id,
          phoneNumber: body.phoneNumber,
          fournisseur: fournisseur!,
        }
      );
    }

    // Invalider les caches
    await invalidateSubscriptionCaches(auth.userId);

    const responseBody: Record<string, unknown> = {
      abonnement: result.nouvelAbonnement,
      type: result.type,
      prorata: {
        creditProrata,
        prixNouveauPlan,
        montantAPayer: result.delta.montantAPayer,
        creditRestant: result.delta.creditRestant,
      },
    };

    if (paiementResult) {
      responseBody.paiement = {
        paiementId: paiementResult.paiementId,
        referenceExterne: paiementResult.referenceExterne,
        statut: paiementResult.statut,
      };
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    // Erreur métier levée depuis la transaction
    if (error instanceof Error && error.message.startsWith("FOURNISSEUR_REQUIS:")) {
      return apiError(400, error.message.replace("FOURNISSEUR_REQUIS:", ""));
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    console.error("[upgrade] Erreur:", error);
    return NextResponse.json(
      { status: 500, message: `Erreur serveur lors de l'upgrade. ${message}` },
      { status: 500 }
    );
  }
}
