/**
 * src/app/api/portefeuille/retrait/route.ts
 *
 * POST /api/portefeuille/retrait — demander un retrait du portefeuille.
 *
 * - Auth + Permission.PORTEFEUILLE_VOIR
 * - Vérifie que le solde >= montant
 * - Crée un RetraitPortefeuille EN_ATTENTE
 *
 * Story 34.2 — Sprint 34
 * R2 : enums importés depuis @/types
 * R4 : atomicité via demanderRetrait (transaction Prisma)
 * R8 : siteId = auth.activeSiteId
 */
import { NextRequest, NextResponse } from "next/server";
import { demanderRetrait } from "@/lib/queries/commissions";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { Permission, FournisseurPaiement } from "@/types";
import type { DemandeRetraitDTO } from "@/types";

const VALID_FOURNISSEURS = Object.values(FournisseurPaiement);

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PORTEFEUILLE_VOIR);
    const body = await request.json() as Partial<DemandeRetraitDTO>;

    // Validation des champs requis
    const errors: { field: string; message: string }[] = [];

    if (!body.montant || typeof body.montant !== "number" || body.montant <= 0) {
      errors.push({ field: "montant", message: "Le montant doit être un nombre positif." });
    }
    if (body.montant && body.montant < 5000) {
      errors.push({ field: "montant", message: "Le montant minimum de retrait est de 5 000 FCFA." });
    }
    if (!body.phoneNumber || body.phoneNumber.trim().length === 0) {
      errors.push({ field: "phoneNumber", message: "Le numéro de téléphone est requis." });
    }
    if (!body.fournisseur || !VALID_FOURNISSEURS.includes(body.fournisseur)) {
      errors.push({ field: "fournisseur", message: "Le fournisseur de paiement est invalide." });
    }

    if (errors.length > 0) {
      return NextResponse.json({ status: 400, errors }, { status: 400 });
    }

    const dto: DemandeRetraitDTO = {
      montant: body.montant!,
      phoneNumber: body.phoneNumber!.trim(),
      fournisseur: body.fournisseur!,
    };

    const retrait = await demanderRetrait(auth.userId, dto, auth.activeSiteId);
    return NextResponse.json({ retrait }, { status: 201 });
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
    if (error instanceof Error && error.message.includes("Solde insuffisant")) {
      return NextResponse.json(
        { status: 400, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la demande de retrait." },
      { status: 500 }
    );
  }
}
