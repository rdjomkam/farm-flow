/**
 * src/app/api/abonnements/[id]/convertir-essai/route.ts
 *
 * POST /api/abonnements/[id]/convertir-essai — Convertir un essai gratuit en abonnement payant
 *
 * Story 49.2 — Sprint 49
 *
 * Regles :
 * - Verifier que abonnement.isEssai === true, sinon 400
 * - Verifier que le statut est ACTIF (l'essai est encore en cours)
 * - Update isEssai = false sur l'abonnement existant (RISQUE-3 : pas de nouvel abonnement)
 * - Recalculer dateDebut = now, dateFin = now + periode
 * - Initier le paiement via initierPaiement
 * - logAbonnementAudit avec action "CONVERSION_ESSAI"
 * - invalidateSubscriptionCaches apres conversion
 *
 * R2 : enums importes depuis @/types
 * R4 : update dans $transaction
 * R8 : siteId = auth.activeSiteId
 */
import { NextRequest, NextResponse } from "next/server";
import { getAbonnementById, logAbonnementAudit } from "@/lib/queries/abonnements";
import { getPlanAbonnementById } from "@/lib/queries/plans-abonnements";
import { initierPaiement } from "@/lib/services/billing";
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
import { apiError, handleApiError } from "@/lib/api-utils";
import {
  PLAN_TARIFS,
  calculerProchaineDate,
} from "@/lib/abonnements-constants";

const VALID_FOURNISSEURS = Object.values(FournisseurPaiement);
const VALID_PERIODES = Object.values(PeriodeFacturation);

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

    // Vérifier que c'est bien un essai
    if (!abonnement.isEssai) {
      return NextResponse.json(
        {
          status: 400,
          message: "Cet abonnement n'est pas un essai gratuit. Utilisez la route de renouvellement.",
        },
        { status: 400 }
      );
    }

    // Vérifier que l'essai est encore actif
    if ((abonnement.statut as string) !== StatutAbonnement.ACTIF) {
      return NextResponse.json(
        {
          status: 400,
          message: `Cet essai ne peut pas etre converti. Statut actuel : ${abonnement.statut}. Seuls les essais ACTIF peuvent etre convertis.`,
        },
        { status: 400 }
      );
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

    // Validation de la période (optionnelle — utilise la période de l'essai si non fournie)
    const periode = (body.periode ?? abonnement.periode) as PeriodeFacturation;
    if (body.periode && !VALID_PERIODES.includes(body.periode as PeriodeFacturation)) {
      return NextResponse.json(
        {
          status: 400,
          message: `Periode invalide. Valeurs acceptees : ${VALID_PERIODES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Charger le plan
    const plan = await getPlanAbonnementById(abonnement.planId);
    if (!plan || !plan.isActif) {
      return apiError(404, "Plan de l'abonnement introuvable ou inactif.");
    }

    // Calculer le prix selon la période
    // R2/ERR-031 : cast as TypePlan, jamais as keyof typeof PLAN_TARIFS
    const tarifsType = PLAN_TARIFS[plan.typePlan as TypePlan];
    const prixPlan = (tarifsType?.[periode] ?? 0) as number;

    // Calculer les nouvelles dates (paiement commence maintenant)
    const dateDebut = new Date();
    const dateFin = calculerProchaineDate(dateDebut, periode);

    // R4 : Mettre à jour l'abonnement existant dans une $transaction
    // RISQUE-3 : on update l'abonnement existant (isEssai=false) au lieu d'en créer un nouveau
    // L'essai reste en statut EN_ATTENTE_PAIEMENT jusqu'à confirmation du paiement
    // Sprint 52 : ownership déjà vérifié via userId ci-dessus
    const abonnementMisAJour = await prisma.$transaction(async (tx) => {
      return tx.abonnement.update({
        where: {
          id: abonnement.id,
        },
        data: {
          isEssai: false,
          statut: StatutAbonnement.EN_ATTENTE_PAIEMENT,
          dateDebut,
          dateFin,
          dateProchainRenouvellement: dateFin,
          prixPaye: prixPlan,
          periode,
        },
      });
    });

    // Journaliser la conversion (fire-and-forget)
    logAbonnementAudit(abonnement.id, "CONVERSION_ESSAI", auth.userId, {
      planId: abonnement.planId,
      typePlan: plan.typePlan,
      periode,
      prixPlan,
      dateDebut: dateDebut.toISOString(),
      dateFin: dateFin.toISOString(),
    }).catch((err) => {
      console.error("[convertir-essai] Erreur logAbonnementAudit (ignoree) :", err);
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
        abonnement: abonnementMisAJour,
        paiement: {
          paiementId: paiement.paiementId,
          referenceExterne: paiement.referenceExterne,
          statut: paiement.statut,
        },
        message: "Conversion de l'essai initiee. Veuillez confirmer le paiement pour activer votre abonnement.",
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError("POST /api/abonnements/[id]/convertir-essai", error, "Erreur serveur lors de la conversion de l'essai.");
  }
}
