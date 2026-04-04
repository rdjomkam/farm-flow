/**
 * src/app/api/abonnements/statut-middleware/route.ts
 *
 * GET /api/abonnements/statut-middleware
 *
 * Route interne appelée par le middleware Edge pour vérifier le statut
 * d'abonnement du site actif de la session courante.
 *
 * Pourquoi une route dédiée ? Le middleware Next.js tourne sur Edge Runtime,
 * qui est incompatible avec Prisma. Le middleware fait donc un fetch vers cette
 * route qui s'exécute en Node.js standard avec accès Prisma.
 *
 * Réponse : { statut, isDecouverte, planId, isBlocked }
 *   - statut     : StatutAbonnement | null
 *   - isDecouverte : boolean (plan DECOUVERTE — pas de restriction)
 *   - planId     : string | null (dernier plan souscrit, pour le lien renouvellement)
 *   - isBlocked  : boolean (true si EXPIRE ou ANNULE)
 *
 * Story 36.3 — Sprint 36
 * R2 : enums importés depuis @/types
 * R8 : siteId = session.activeSiteId
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSubscriptionStatusForSite, isBlocked } from "@/lib/abonnements/check-subscription";
import { prisma } from "@/lib/db";
import { StatutAbonnement, TypePlan } from "@/types";

export async function GET(request: NextRequest) {
  try {
    // Lire la session depuis le cookie (Node.js runtime — Prisma disponible)
    const session = await getSession(request);

    if (!session || !session.activeSiteId) {
      // Pas de session → pas de restriction d'abonnement (le middleware auth gère le redirect /login)
      return NextResponse.json({
        statut: null,
        isDecouverte: false,
        planId: null,
        isBlocked: false,
      });
    }

    const status = await getSubscriptionStatusForSite(session.activeSiteId);

    // isDecouverte : plan DECOUVERTE ne bloque jamais
    // R2 : comparaison via enum TypePlan.DECOUVERTE
    const isDecouverteFlag =
      status.isDecouverte ||
      (status.planType as string) === TypePlan.DECOUVERTE;

    // Récupérer le planId du dernier abonnement pour le lien de renouvellement
    let planId: string | null = null;
    if (!isDecouverteFlag) {
      const lastAbonnement = await prisma.abonnement.findFirst({
        where: { siteId: session.activeSiteId },
        orderBy: { createdAt: "desc" },
        select: { planId: true },
      });
      planId = lastAbonnement?.planId ?? null;
    }

    const blockedFlag = isDecouverteFlag
      ? false
      : isBlocked(status.statut as StatutAbonnement | null);

    return NextResponse.json({
      statut: status.statut,
      isDecouverte: isDecouverteFlag,
      planId,
      isBlocked: blockedFlag,
    });
  } catch (error) {
    console.error("[statut-middleware] Erreur :", error);
    // En cas d'erreur, on ne bloque pas l'accès — fail open
    return NextResponse.json({
      statut: null,
      isDecouverte: false,
      planId: null,
      isBlocked: false,
    });
  }
}
