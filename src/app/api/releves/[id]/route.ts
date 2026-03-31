import { NextRequest, NextResponse } from "next/server";
import { getReleveById, updateReleve, patchReleve, deleteReleve } from "@/lib/queries/releves";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import {
  TypeReleve,
  Permission,
  ComportementAlimentaire,
} from "@/types";
import type { UpdateReleveDTO } from "@/types";
import { prisma } from "@/lib/db";
import { runEngineForSite } from "@/lib/activity-engine";
import { retryAsync } from "@/lib/async-retry";
import { ErrorKeys } from "@/lib/api-error-keys";
import { apiError } from "@/lib/api-utils";
import {
  updateReleveSchema,
  patchReleveSchema,
  zodErrorToFieldErrors,
} from "@/lib/validation/releve.schema";

/** Champs structurels non modifiables via PUT ou PATCH */
const NON_MODIFIABLE_FIELDS_PUT = ["typeReleve", "vagueId", "bacId", "siteId"];
/** Champs structurels non modifiables via PATCH */
const NON_MODIFIABLE_FIELDS_PATCH = ["id", "vagueId", "bacId", "siteId", "typeReleve", "userId", "createdAt"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.RELEVES_VOIR);
    const { id } = await params;
    const releve = await getReleveById(auth.activeSiteId, id);

    if (!releve) {
      return NextResponse.json(
        { status: 404, message: "Releve introuvable.", errorKey: ErrorKeys.NOT_FOUND_RELEVE },
        { status: 404 }
      );
    }

    return NextResponse.json(releve);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation du releve.", errorKey: ErrorKeys.SERVER_GET_RELEVE },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.RELEVES_MODIFIER);
    const { id } = await params;
    const body = await request.json();

    // Reject structural fields that cannot be modified
    const structuralErrors: { field: string; message: string }[] = [];
    for (const field of NON_MODIFIABLE_FIELDS_PUT) {
      if (body[field] !== undefined) {
        structuralErrors.push({
          field,
          message: field === "typeReleve"
            ? "Le type de releve ne peut pas etre modifie."
            : `Le champ '${field}' ne peut pas etre modifie.`,
        });
      }
    }
    if (structuralErrors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors: structuralErrors });
    }

    // Validate with Zod schema
    const parseResult = updateReleveSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError(400, "Erreurs de validation", { errors: zodErrorToFieldErrors(parseResult.error) });
    }

    const validated = parseResult.data;

    // Additional cross-field validation: tauxRefus and comportementAlim require ALIMENTATION type
    const hasTauxRefus = validated.tauxRefus !== undefined && validated.tauxRefus !== null;
    const hasComportementAlim = validated.comportementAlim !== undefined && validated.comportementAlim !== null;
    if (hasTauxRefus || hasComportementAlim) {
      const existingReleve = await prisma.releve.findFirst({
        where: { id, siteId: auth.activeSiteId },
        select: { typeReleve: true },
      });
      const typeReleveExistant = existingReleve?.typeReleve;
      const extraErrors: { field: string; message: string }[] = [];

      if (hasTauxRefus && typeReleveExistant !== TypeReleve.ALIMENTATION) {
        extraErrors.push({
          field: "tauxRefus",
          message: "Le taux de refus est valide uniquement pour un releve de type ALIMENTATION.",
        });
      }
      if (hasComportementAlim && typeReleveExistant !== TypeReleve.ALIMENTATION) {
        extraErrors.push({
          field: "comportementAlim",
          message: "Le comportement alimentaire est valide uniquement pour un releve de type ALIMENTATION.",
        });
      }
      if (extraErrors.length > 0) {
        return apiError(400, "Erreurs de validation", { errors: extraErrors });
      }
    }

    // Build clean DTO
    const data: UpdateReleveDTO = {};
    if (validated.date !== undefined) data.date = new Date(validated.date);
    if (validated.notes !== undefined) data.notes = validated.notes;
    if (validated.poidsMoyen !== undefined) data.poidsMoyen = validated.poidsMoyen;
    if (validated.tailleMoyenne !== undefined) data.tailleMoyenne = validated.tailleMoyenne ?? undefined;
    if (validated.echantillonCount !== undefined) data.echantillonCount = validated.echantillonCount;
    if (validated.nombreMorts !== undefined) data.nombreMorts = validated.nombreMorts;
    if (validated.causeMortalite !== undefined) data.causeMortalite = validated.causeMortalite;
    if (validated.quantiteAliment !== undefined) data.quantiteAliment = validated.quantiteAliment;
    if (validated.typeAliment !== undefined) data.typeAliment = validated.typeAliment;
    if (validated.frequenceAliment !== undefined) data.frequenceAliment = validated.frequenceAliment;
    if (validated.temperature !== undefined) data.temperature = validated.temperature ?? undefined;
    if (validated.ph !== undefined) data.ph = validated.ph ?? undefined;
    if (validated.oxygene !== undefined) data.oxygene = validated.oxygene ?? undefined;
    if (validated.ammoniac !== undefined) data.ammoniac = validated.ammoniac ?? undefined;
    if (validated.nombreCompte !== undefined) data.nombreCompte = validated.nombreCompte;
    if (validated.methodeComptage !== undefined) data.methodeComptage = validated.methodeComptage;
    if (validated.description !== undefined) data.description = validated.description;
    if (validated.consommations !== undefined) data.consommations = validated.consommations;
    if (validated.pourcentageRenouvellement !== undefined) data.pourcentageRenouvellement = validated.pourcentageRenouvellement ?? undefined;
    if (validated.volumeRenouvele !== undefined) data.volumeRenouvele = validated.volumeRenouvele ?? undefined;
    if (validated.nombreRenouvellements !== undefined) data.nombreRenouvellements = validated.nombreRenouvellements ?? undefined;
    if (validated.tauxRefus !== undefined) data.tauxRefus = validated.tauxRefus;
    if (validated.comportementAlim !== undefined) data.comportementAlim = validated.comportementAlim as ComportementAlimentaire;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { status: 400, message: "Aucun champ a modifier." },
        { status: 400 }
      );
    }

    const releve = await updateReleve(auth.activeSiteId, auth.userId, id, data);
    return NextResponse.json(releve);
  } catch (error) {
    console.error("[PUT /api/releves/[id]] Error:", error);
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur inattendue.";

    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }

    if (message.includes("Stock insuffisant") || message.includes("n'appartient pas") || message.includes("n'est pas de categorie")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }

    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la mise a jour du releve.", errorKey: ErrorKeys.SERVER_UPDATE_RELEVE },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — Modification de releve avec raison obligatoire et traçabilite (ADR-014)
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.RELEVES_MODIFIER);
    const { id } = await params;
    const body = await request.json();

    // 1. Reject structural non-modifiable fields early
    const structuralErrors: { field: string; message: string }[] = [];
    for (const field of NON_MODIFIABLE_FIELDS_PATCH) {
      if (body[field] !== undefined) {
        structuralErrors.push({ field, message: `Le champ '${field}' ne peut pas etre modifie.` });
      }
    }
    if (structuralErrors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors: structuralErrors });
    }

    // 2. Validate with Zod schema (includes raison validation)
    const parseResult = patchReleveSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError(400, "Erreurs de validation", { errors: zodErrorToFieldErrors(parseResult.error) });
    }

    const validated = parseResult.data;

    // 3. Cross-field validation: tauxRefus and comportementAlim require ALIMENTATION type
    const hasTauxRefusPatch = validated.tauxRefus !== undefined && validated.tauxRefus !== null;
    const hasComportementAlimPatch = validated.comportementAlim !== undefined && validated.comportementAlim !== null;
    if (hasTauxRefusPatch || hasComportementAlimPatch) {
      const existingRelevePatch = await prisma.releve.findFirst({
        where: { id, siteId: auth.activeSiteId },
        select: { typeReleve: true },
      });
      const typeReleveExistantPatch = existingRelevePatch?.typeReleve;
      const extraErrors: { field: string; message: string }[] = [];

      if (hasTauxRefusPatch && typeReleveExistantPatch !== TypeReleve.ALIMENTATION) {
        extraErrors.push({
          field: "tauxRefus",
          message: "Le taux de refus est valide uniquement pour un releve de type ALIMENTATION.",
        });
      }
      if (hasComportementAlimPatch && typeReleveExistantPatch !== TypeReleve.ALIMENTATION) {
        extraErrors.push({
          field: "comportementAlim",
          message: "Le comportement alimentaire est valide uniquement pour un releve de type ALIMENTATION.",
        });
      }
      if (extraErrors.length > 0) {
        return apiError(400, "Erreurs de validation", { errors: extraErrors });
      }
    }

    // 4. Construire le DTO (champs metier uniquement, hors raison)
    const data: UpdateReleveDTO = {};
    if (validated.date !== undefined) data.date = new Date(validated.date);
    if (validated.notes !== undefined) data.notes = validated.notes;
    if (validated.poidsMoyen !== undefined) data.poidsMoyen = validated.poidsMoyen;
    if (validated.tailleMoyenne !== undefined) data.tailleMoyenne = validated.tailleMoyenne ?? undefined;
    if (validated.echantillonCount !== undefined) data.echantillonCount = validated.echantillonCount;
    if (validated.nombreMorts !== undefined) data.nombreMorts = validated.nombreMorts;
    if (validated.causeMortalite !== undefined) data.causeMortalite = validated.causeMortalite;
    if (validated.quantiteAliment !== undefined) data.quantiteAliment = validated.quantiteAliment;
    if (validated.typeAliment !== undefined) data.typeAliment = validated.typeAliment;
    if (validated.frequenceAliment !== undefined) data.frequenceAliment = validated.frequenceAliment;
    if (validated.temperature !== undefined) data.temperature = validated.temperature ?? undefined;
    if (validated.ph !== undefined) data.ph = validated.ph ?? undefined;
    if (validated.oxygene !== undefined) data.oxygene = validated.oxygene ?? undefined;
    if (validated.ammoniac !== undefined) data.ammoniac = validated.ammoniac ?? undefined;
    if (validated.nombreCompte !== undefined) data.nombreCompte = validated.nombreCompte;
    if (validated.methodeComptage !== undefined) data.methodeComptage = validated.methodeComptage;
    if (validated.description !== undefined) data.description = validated.description;
    if (validated.consommations !== undefined) data.consommations = validated.consommations;
    if (validated.pourcentageRenouvellement !== undefined) data.pourcentageRenouvellement = validated.pourcentageRenouvellement ?? undefined;
    if (validated.volumeRenouvele !== undefined) data.volumeRenouvele = validated.volumeRenouvele ?? undefined;
    if (validated.nombreRenouvellements !== undefined) data.nombreRenouvellements = validated.nombreRenouvellements ?? undefined;
    if (validated.tauxRefus !== undefined) data.tauxRefus = validated.tauxRefus;
    if (validated.comportementAlim !== undefined) data.comportementAlim = validated.comportementAlim as ComportementAlimentaire;

    // 5. Verifier qu'au moins un champ metier est fourni (hors raison)
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { status: 400, message: "Au moins un champ metier doit etre fourni (en dehors de la raison)." },
        { status: 400 }
      );
    }

    const raison = validated.raison;

    // 6. Appeler patchReleve
    const result = await patchReleve(auth.activeSiteId, auth.userId, id, data, raison);

    // 7. Reevaluation asynchrone des regles SEUIL_* (fire-and-forget)
    // Réutiliser le résultat de patchReleve — pas besoin d'une query supplémentaire
    const seuilTypes = [TypeReleve.BIOMETRIE, TypeReleve.MORTALITE, TypeReleve.ALIMENTATION, TypeReleve.QUALITE_EAU];
    if (seuilTypes.includes(result.releve.typeReleve as TypeReleve)) {
      triggerSeuilRulesForPatch(auth.activeSiteId, result.releve.vagueId, auth.userId);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[PATCH /api/releves/[id]] Error:", error);
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur inattendue.";

    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    if (message.includes("cloturee")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }
    if (message.includes("Stock insuffisant") || message.includes("n'appartient pas") || message.includes("n'est pas de categorie")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }

    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la modification du releve.", errorKey: ErrorKeys.SERVER_UPDATE_RELEVE },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Suppression d'un releve avec restauration du stock
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.RELEVES_SUPPRIMER);
    const { id } = await params;

    const result = await deleteReleve(auth.activeSiteId, id);

    // Fire-and-forget SEUIL reevaluation (same pattern as PATCH)
    const seuilTypes = [TypeReleve.BIOMETRIE, TypeReleve.MORTALITE, TypeReleve.ALIMENTATION, TypeReleve.QUALITE_EAU];
    if (seuilTypes.includes(result.typeReleve as TypeReleve)) {
      retryAsync(
        async () => { await runEngineForSite(auth.activeSiteId, auth.userId); },
        { context: "[DELETE /api/releves/[id]] hook SEUIL" }
      );
    }

    return NextResponse.json({ message: result.message }, { status: 200 });
  } catch (error) {
    console.error("[DELETE /api/releves/[id]] Error:", error);
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur inattendue.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la suppression du releve.", errorKey: ErrorKeys.SERVER_DELETE_RELEVE },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Hook asynchrone — reevaluation des regles SEUIL_* apres PATCH
// ---------------------------------------------------------------------------

/**
 * Declenche la reevaluation des regles SEUIL_* apres modification d'un releve.
 * Utilise le moteur d'orchestration complet pour coherence avec les autres declencheurs.
 */
async function triggerSeuilRulesForPatch(
  siteId: string,
  _vagueId: string,
  userId: string
): Promise<void> {
  await retryAsync(
    async () => { await runEngineForSite(siteId, userId); },
    { context: "[PATCH /api/releves/[id]] hook SEUIL" }
  );
}
