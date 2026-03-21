/**
 * src/app/api/portefeuille/retrait/[id]/traiter/route.ts
 *
 * POST /api/portefeuille/retrait/[id]/traiter — traiter un retrait (admin DKFarm).
 *
 * - Auth + Permission.PORTEFEUILLE_GERER
 * - Marque le retrait comme CONFIRME ou ECHEC
 * - En cas d'ECHEC, rembourse le solde (via traiterRetrait)
 *
 * Story 34.2 — Sprint 34
 * R2 : enums importés depuis @/types
 * R4 : atomicité via traiterRetrait (transaction Prisma)
 */
import { NextRequest, NextResponse } from "next/server";
import { traiterRetrait } from "@/lib/queries/commissions";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { Permission, StatutPaiementAbo } from "@/types";

const VALID_STATUTS = [StatutPaiementAbo.CONFIRME, StatutPaiementAbo.ECHEC] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.PORTEFEUILLE_GERER);
    const body = await request.json() as {
      statut?: string;
      referenceExterne?: string;
    };

    // Validation
    const errors: { field: string; message: string }[] = [];

    if (!body.statut || !VALID_STATUTS.includes(body.statut as typeof VALID_STATUTS[number])) {
      errors.push({
        field: "statut",
        message: `Le statut doit être CONFIRME ou ECHEC.`,
      });
    }
    if (!body.referenceExterne || body.referenceExterne.trim().length === 0) {
      errors.push({
        field: "referenceExterne",
        message: "La référence de virement est obligatoire.",
      });
    }

    if (errors.length > 0) {
      return NextResponse.json({ status: 400, errors }, { status: 400 });
    }

    const statut = body.statut as typeof StatutPaiementAbo.CONFIRME | typeof StatutPaiementAbo.ECHEC;
    const result = await traiterRetrait(
      id,
      auth.userId,
      body.referenceExterne!.trim(),
      statut
    );

    if (result.count === 0) {
      return NextResponse.json(
        { status: 404, message: "Retrait introuvable ou déjà traité." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du traitement du retrait." },
      { status: 500 }
    );
  }
}
