/**
 * src/app/api/backoffice/exonerations/route.ts
 *
 * GET  /api/backoffice/exonerations — liste tous les abonnements EXONERATION
 * POST /api/backoffice/exonerations — crée un abonnement EXONERATION
 *
 * Guard : requireSuperAdmin (isSuperAdmin vérifié depuis DB, ADR-022)
 *
 * POST — champs requis :
 *   - userId    : ID de l'utilisateur bénéficiaire
 *   - motif     : raison de l'exonération (obligatoire)
 *   - dateFin?  : date de fin (optionnel — si absent → permanent = 2099-12-31)
 *
 * Sprint 52 : siteId supprimé — l'abonnement EXONERATION est au niveau user.
 *
 * Logique :
 *   1. Trouve le PlanAbonnement où typePlan = EXONERATION
 *   2. Crée l'abonnement avec statut ACTIF, prixPaye = 0, periode = MENSUEL
 *   3. Enregistre un audit "EXONERATION"
 *   4. Invalide les caches subscription
 *
 * R2 : enums importés depuis @/types
 * R4 : opérations atomiques ($transaction)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-utils";
import { TypePlan, StatutAbonnement, PeriodeFacturation } from "@/types";
import { logAbonnementAudit } from "@/lib/queries/abonnements";
import { invalidateSubscriptionCaches } from "@/lib/abonnements/invalidate-caches";

// ---------------------------------------------------------------------------
// Constante — date "permanente" (Sprint 51 workaround, ADR-020)
// ---------------------------------------------------------------------------
const DATE_PERMANENTE = new Date("2099-12-31T23:59:59.000Z");

export async function GET(request: NextRequest) {
  try {
    const adminSession = await requireSuperAdmin(request);
    void adminSession; // guard vérifié — userId disponible si nécessaire

    const exonerations = await prisma.abonnement.findMany({
      where: {
        plan: {
          typePlan: TypePlan.EXONERATION,
        },
      },
      include: {
        plan: { select: { id: true, nom: true, typePlan: true } },
        site: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      exonerations,
      total: exonerations.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des exonerations.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminSession = await requireSuperAdmin(request);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validation des champs requis
    if (!body.userId || typeof body.userId !== "string" || body.userId.trim() === "") {
      errors.push({ field: "userId", message: "L'identifiant de l'utilisateur est obligatoire." });
    }

    if (!body.motif || typeof body.motif !== "string" || body.motif.trim() === "") {
      errors.push({ field: "motif", message: "Le motif de l'exoneration est obligatoire." });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation.", { errors });
    }

    const userId = body.userId.trim() as string;
    const motif = body.motif.trim() as string;

    // dateFin : si absente → permanent (2099-12-31)
    let dateFin: Date;
    if (body.dateFin) {
      const parsed = new Date(body.dateFin as string);
      if (isNaN(parsed.getTime())) {
        return apiError(400, "Format de date invalide pour dateFin.", {
          errors: [{ field: "dateFin", message: "Format de date invalide. Utiliser ISO 8601." }],
        });
      }
      dateFin = parsed;
    } else {
      dateFin = DATE_PERMANENTE;
    }

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });
    if (!user) {
      return apiError(404, "Utilisateur introuvable.", {
        errors: [{ field: "userId", message: "Aucun utilisateur avec cet identifiant." }],
      });
    }

    // Trouver le plan EXONERATION (doit exister — créé lors du seed)
    const planExoneration = await prisma.planAbonnement.findFirst({
      where: { typePlan: TypePlan.EXONERATION },
    });
    if (!planExoneration) {
      return apiError(500, "Plan EXONERATION introuvable en base. Veuillez contacter l'equipe technique.");
    }

    // R4 : création atomique dans une $transaction
    // Sprint 52 : siteId supprimé de l'abonnement (user-level)
    const abonnement = await prisma.$transaction(async (tx) => {
      const dateDebut = new Date();

      const newAbonnement = await tx.abonnement.create({
        data: {
          planId: planExoneration.id,
          // R2 : enums via TypeScript enum
          periode: PeriodeFacturation.MENSUEL,
          statut: StatutAbonnement.ACTIF,
          dateDebut,
          dateFin,
          // Pour une exonération, le prochain renouvellement = dateFin
          // Le CRON ne se déclenchera pas avant cette date
          dateProchainRenouvellement: dateFin,
          prixPaye: 0,
          userId,
          motifExoneration: motif,
        },
        include: {
          plan: { select: { id: true, nom: true, typePlan: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return newAbonnement;
    });

    // Audit hors transaction (non-critique si échec)
    await logAbonnementAudit(abonnement.id, "EXONERATION", adminSession.userId, {
      motif,
      userId,
      dateFin: dateFin.toISOString(),
      createdByAdmin: adminSession.userId,
    }).catch(() => {
      // Log audit failure silencieusement — n'empêche pas la réponse
    });

    // Invalider les caches subscription pour l'utilisateur
    await invalidateSubscriptionCaches(userId).catch(() => {
      // Invalide silencieusement — le prochain accès rechargera depuis la DB
    });

    return NextResponse.json(abonnement, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la creation de l'exoneration.");
  }
}
