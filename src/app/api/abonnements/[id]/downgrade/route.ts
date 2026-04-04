/**
 * src/app/api/abonnements/[id]/downgrade/route.ts
 *
 * POST /api/abonnements/[id]/downgrade — Programmer un downgrade de plan
 *
 * Story 50.2 — Sprint 50
 * R2 : enums importés depuis @/types
 * R4 : atomique via $transaction (ERR-016)
 * R7 : ERR-007 — cast Prisma.InputJsonValue pour downgradeRessourcesAGarder
 * R8 : siteId = auth.activeSiteId
 *
 * Le downgrade est programmé pour le prochain renouvellement.
 * Il est appliqué par le CRON job (Story 50.5).
 */
import { NextRequest, NextResponse } from "next/server";
import { getAbonnementById, logAbonnementAudit } from "@/lib/queries/abonnements";
import { getPlanAbonnementById } from "@/lib/queries/plans-abonnements";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { invalidateSubscriptionCaches } from "@/lib/abonnements/invalidate-caches";
import { AuthError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Permission,
  StatutAbonnement,
  PeriodeFacturation,
  TypePlan,
} from "@/types";
import { apiError } from "@/lib/api-utils";
import { PLAN_LIMITES } from "@/lib/abonnements-constants";
import type { Prisma } from "@/generated/prisma/client";
import { Prisma as PrismaNamespace } from "@/generated/prisma/client";
import type { DowngradeRessourcesAGarder } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.ABONNEMENTS_GERER);

    // Charger l'abonnement — R8 : siteId obligatoire
    const abonnement = await getAbonnementById(id, auth.activeSiteId);
    if (!abonnement) {
      return apiError(404, "Abonnement introuvable.");
    }

    // Vérifier que l'abonnement est actif
    if ((abonnement.statut as string) !== StatutAbonnement.ACTIF) {
      return apiError(
        400,
        `Seuls les abonnements ACTIF peuvent être downgradés. Statut actuel : ${abonnement.statut}`
      );
    }

    const body = await request.json();

    // Validation du corps de la requête (DowngradeDTO)
    if (!body.nouveauPlanId || typeof body.nouveauPlanId !== "string") {
      return apiError(400, "Le champ nouveauPlanId est obligatoire.");
    }

    const periodeValides = Object.values(PeriodeFacturation);
    const periode: PeriodeFacturation =
      body.periode && periodeValides.includes(body.periode as PeriodeFacturation)
        ? (body.periode as PeriodeFacturation)
        : (abonnement.periode as PeriodeFacturation);

    // Valider ressourcesAGarder
    const ressourcesAGarder: DowngradeRessourcesAGarder = body.ressourcesAGarder ?? {
      sites: [],
      bacs: {},
      vagues: {},
    };

    if (
      !Array.isArray(ressourcesAGarder.sites) ||
      typeof ressourcesAGarder.bacs !== "object" ||
      typeof ressourcesAGarder.vagues !== "object"
    ) {
      return apiError(
        400,
        "Le champ ressourcesAGarder doit contenir sites (tableau), bacs et vagues (objets)."
      );
    }

    // Charger le nouveau plan
    const nouveauPlan = await getPlanAbonnementById(body.nouveauPlanId);
    if (!nouveauPlan || !nouveauPlan.isActif) {
      return apiError(404, "Nouveau plan introuvable ou inactif.");
    }

    if (nouveauPlan.id === abonnement.planId) {
      return apiError(400, "Le nouveau plan est identique au plan actuel.");
    }

    // Valider que ressourcesAGarder respecte les limites du nouveau plan
    // R2/ERR-031 : cast as TypePlan
    const limitesNouveauPlan = PLAN_LIMITES[nouveauPlan.typePlan as TypePlan];
    if (!limitesNouveauPlan) {
      return apiError(500, "Limites du nouveau plan introuvables.");
    }

    const nbSitesAGarder = ressourcesAGarder.sites.length;
    const nbBacsAGarder = Object.values(ressourcesAGarder.bacs).flat().length;
    const nbVaguesAGarder = Object.values(ressourcesAGarder.vagues).flat().length;

    if (nbSitesAGarder > limitesNouveauPlan.limitesSites) {
      return apiError(
        400,
        `Le nouveau plan autorise au maximum ${limitesNouveauPlan.limitesSites} site(s). Vous en avez sélectionné ${nbSitesAGarder}.`
      );
    }

    if (nbBacsAGarder > limitesNouveauPlan.limitesBacs) {
      return apiError(
        400,
        `Le nouveau plan autorise au maximum ${limitesNouveauPlan.limitesBacs} bac(s). Vous en avez sélectionné ${nbBacsAGarder}.`
      );
    }

    if (nbVaguesAGarder > limitesNouveauPlan.limitesVagues) {
      return apiError(
        400,
        `Le nouveau plan autorise au maximum ${limitesNouveauPlan.limitesVagues} vague(s). Vous en avez sélectionné ${nbVaguesAGarder}.`
      );
    }

    // R4 : Programmer le downgrade atomiquement
    // ERR-007 : cast as Prisma.InputJsonValue pour le champ Json
    const abonnementMisAJour = await prisma.$transaction(async (tx) => {
      return tx.abonnement.update({
        where: { id: abonnement.id },
        data: {
          downgradeVersId: nouveauPlan.id,
          downgradePeriode: periode,
          downgradeRessourcesAGarder: ressourcesAGarder as unknown as Prisma.InputJsonValue,
        },
      });
    });

    // Journaliser (fire-and-forget)
    logAbonnementAudit(abonnement.id, "DOWNGRADE_PROGRAMME", auth.userId, {
      nouveauPlanId: nouveauPlan.id,
      nouveauPlanNom: nouveauPlan.nom,
      nouveauPlanType: nouveauPlan.typePlan,
      periode,
      ressourcesAGarder: {
        nbSites: nbSitesAGarder,
        nbBacs: nbBacsAGarder,
        nbVagues: nbVaguesAGarder,
      },
      dateApplicationPrevue: abonnement.dateProchainRenouvellement,
    }).catch((err) => {
      console.error("[downgrade] Erreur logAbonnementAudit (ignorée) :", err);
    });

    // Invalider les caches
    await invalidateSubscriptionCaches(auth.userId);

    return NextResponse.json(
      {
        abonnement: abonnementMisAJour,
        message: `Downgrade programmé vers le plan ${nouveauPlan.nom} pour le prochain renouvellement (${abonnement.dateProchainRenouvellement.toISOString().slice(0, 10)}).`,
        downgrade: {
          nouveauPlanId: nouveauPlan.id,
          nouveauPlanNom: nouveauPlan.nom,
          periode,
          dateApplication: abonnement.dateProchainRenouvellement,
          ressourcesAGarder: {
            nbSites: nbSitesAGarder,
            nbBacs: nbBacsAGarder,
            nbVagues: nbVaguesAGarder,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    console.error("[downgrade] Erreur:", error);
    return NextResponse.json(
      { status: 500, message: `Erreur serveur lors du downgrade. ${message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/abonnements/[id]/downgrade — Annuler un downgrade programmé
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.ABONNEMENTS_GERER);

    const abonnement = await getAbonnementById(id, auth.activeSiteId);
    if (!abonnement) {
      return apiError(404, "Abonnement introuvable.");
    }

    if (!abonnement.downgradeVersId) {
      return apiError(400, "Aucun downgrade programmé sur cet abonnement.");
    }

    // R4 : Annuler le downgrade atomiquement
    // ERR-007 : Pour nullifier un champ Json? Prisma, utiliser Prisma.DbNull
    await prisma.$transaction(async (tx) => {
      return tx.abonnement.update({
        where: { id: abonnement.id },
        data: {
          downgradeVersId: null,
          downgradePeriode: null,
          downgradeRessourcesAGarder: PrismaNamespace.DbNull,
        },
      });
    });

    // Journaliser (fire-and-forget)
    logAbonnementAudit(abonnement.id, "DOWNGRADE_ANNULE", auth.userId, {
      ancienDowngradePlanId: abonnement.downgradeVersId,
    }).catch((err) => {
      console.error("[downgrade/annuler] Erreur logAbonnementAudit (ignorée) :", err);
    });

    await invalidateSubscriptionCaches(auth.userId);

    return NextResponse.json(
      { message: "Downgrade programmé annulé avec succès." },
      { status: 200 }
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
      { status: 500, message: `Erreur serveur lors de l'annulation du downgrade. ${message}` },
      { status: 500 }
    );
  }
}
