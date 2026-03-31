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
 * R8 : siteId = platformSite.id (BUG-029 : entité plateforme)
 */
import { NextRequest, NextResponse } from "next/server";
import { demanderRetrait } from "@/lib/queries/commissions";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { Permission, FournisseurPaiement } from "@/types";
import type { DemandeRetraitDTO } from "@/types";
import { apiError } from "@/lib/api-utils";

const VALID_FOURNISSEURS = Object.values(FournisseurPaiement);

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PORTEFEUILLE_VOIR);

    // ADR-022: isPlatform removed. Retrait uses activeSiteId directly.

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
      return apiError(400, "Erreurs de validation.", { errors });
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
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    if (error instanceof Error && error.message.includes("Solde insuffisant")) {
      return apiError(400, error.message);
    }
    return apiError(500, "Erreur serveur lors de la demande de retrait.");
  }
}
