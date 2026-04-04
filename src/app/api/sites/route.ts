import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { getUserSites, createSite } from "@/lib/queries/sites";
import { Role } from "@/types";
import { apiError } from "@/lib/api-utils";
import { getQuotaSites } from "@/lib/abonnements/check-quotas";
import { getSubscriptionStatus } from "@/lib/abonnements/check-subscription";

/** GET /api/sites — list sites the user is a member of */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const sites = await getUserSites(session.userId);

    return NextResponse.json({
      sites: sites.map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address,
        isActive: s.isActive,
        memberCount: s._count.members,
        bacCount: s._count.bacs,
        vagueCount: s._count.vagues,
        createdAt: s.createdAt,
      })),
      total: sites.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des sites.");
  }
}

/** POST /api/sites — create a new site (creator becomes Administrateur) */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);

    if (session.role !== Role.ADMIN) {
      return apiError(403, "Seuls les administrateurs peuvent creer des sites.");
    }

    const body = await request.json();

    const errors: { field: string; message: string }[] = [];

    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      errors.push({ field: "name", message: "Le nom du site est obligatoire." });
    }

    if (body.address !== undefined && typeof body.address !== "string") {
      errors.push({ field: "address", message: "L'adresse doit etre une chaine de caracteres." });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    // Story 47 : vérifier que l'utilisateur a un abonnement actif
    const subscriptionStatus = await getSubscriptionStatus(session.userId);
    if (!subscriptionStatus.statut && !subscriptionStatus.isDecouverte) {
      return apiError(402, "Abonnement requis pour créer un site.");
    }

    // Story 47 : vérifier le quota de sites autorisé par le plan
    const quota = await getQuotaSites(session.userId);
    if (quota.remaining !== null && quota.remaining <= 0) {
      return apiError(403, `Quota de sites atteint (${quota.used}/${quota.limit}). Passez à un plan supérieur pour créer plus de sites.`);
    }

    const site = await createSite(
      { name: body.name.trim(), address: body.address?.trim() },
      session.userId
    );

    return NextResponse.json(
      {
        id: site.id,
        name: site.name,
        address: site.address,
        isActive: site.isActive,
        createdAt: site.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    return apiError(500, "Erreur serveur lors de la creation du site.");
  }
}
