/**
 * src/app/api/commissions/route.ts
 *
 * GET /api/commissions — liste des commissions de l'ingénieur connecté.
 *
 * - Auth + Permission.COMMISSIONS_VOIR
 * - Les ingénieurs ne voient que leurs propres commissions
 * - Avec Permission.COMMISSIONS_GERER, peut filtrer par ?ingenieurId=...
 *
 * Story 34.2 — Sprint 34
 * R2 : enums importés depuis @/types
 * R8 : isolation par ingenieurId (pas siteId car commissions cross-site)
 */
import { NextRequest, NextResponse } from "next/server";
import { getCommissionsIngenieur } from "@/lib/queries/commissions";
import { requirePermission } from "@/lib/permissions";
import { Permission, StatutCommissionIng } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

const VALID_STATUTS = Object.values(StatutCommissionIng);

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.COMMISSIONS_VOIR);
    const { searchParams } = new URL(request.url);

    // Déterminer l'ingenieurId cible
    let ingenieurId = auth.userId;

    // Admins et gestionnaires de commissions peuvent voir celles d'autres ingénieurs
    const ingenieurIdParam = searchParams.get("ingenieurId");
    if (ingenieurIdParam && auth.permissions.includes(Permission.COMMISSIONS_GERER)) {
      ingenieurId = ingenieurIdParam;
    }

    // Filtres optionnels
    const statut = searchParams.get("statut");
    const periodeDebutAfter = searchParams.get("periodeDebutAfter");
    const periodeFinBefore = searchParams.get("periodeFinBefore");

    const commissions = await getCommissionsIngenieur(ingenieurId, {
      ...(statut && VALID_STATUTS.includes(statut as StatutCommissionIng) && {
        statut: statut as StatutCommissionIng,
      }),
      ...(periodeDebutAfter && { periodeDebutAfter: new Date(periodeDebutAfter) }),
      ...(periodeFinBefore && { periodeFinBefore: new Date(periodeFinBefore) }),
    });

    return NextResponse.json({ commissions, total: commissions.length });
  } catch (error) {
    return handleApiError("GET /api/commissions", error, "Erreur serveur lors de la recuperation des commissions.");
  }
}
