import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { createTransfert, listTransfertsForSite } from "@/lib/queries/transferts";
import { requirePermission } from "@/lib/permissions";
import { Permission, ModeTransfert } from "@/types";
import type { CreateTransfertDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

const VALID_MODES = new Set(Object.values(ModeTransfert));

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { searchParams } = new URL(request.url);

    const vagueId = searchParams.get("vagueId") ?? undefined;
    const directionRaw = searchParams.get("direction") ?? undefined;
    const limitRaw = searchParams.get("limit");
    const offsetRaw = searchParams.get("offset");

    // Si vagueId fourni sans direction → 400
    if (vagueId && !directionRaw) {
      return apiError(400, "Le parametre 'direction' est obligatoire quand 'vagueId' est fourni. Valeurs acceptees : source, destination.");
    }

    // Valider direction si fournie
    if (directionRaw && directionRaw !== "source" && directionRaw !== "destination") {
      return apiError(400, "Le parametre 'direction' doit etre 'source' ou 'destination'.");
    }
    const direction = directionRaw as "source" | "destination" | undefined;

    const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;
    const offset = offsetRaw ? parseInt(offsetRaw, 10) : undefined;

    if (limit !== undefined && (isNaN(limit) || limit <= 0)) {
      return apiError(400, "Le parametre 'limit' doit etre un entier positif.");
    }
    if (offset !== undefined && (isNaN(offset) || offset < 0)) {
      return apiError(400, "Le parametre 'offset' doit etre un entier >= 0.");
    }

    const result = await listTransfertsForSite(
      auth.activeSiteId,
      vagueId ? { vagueId, direction } : undefined,
      { limit, offset }
    );

    return cachedJson(result, "medium");
  } catch (error) {
    return handleApiError("GET /api/transferts", error, "Erreur serveur lors de la recuperation des transferts.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_CREER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Valider mode
    if (!body.mode || !VALID_MODES.has(body.mode)) {
      errors.push({
        field: "mode",
        message: `Le mode est obligatoire. Valeurs acceptees : ${Object.values(ModeTransfert).join(", ")}.`,
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const mode = body.mode as ModeTransfert;

    // Validation selon le mode
    if (mode === ModeTransfert.CREATE_NEW) {
      const nv = body.nouvelleVague;
      if (!nv || typeof nv !== "object") {
        errors.push({ field: "nouvelleVague", message: "L'objet 'nouvelleVague' est obligatoire en mode CREATE_NEW." });
      } else {
        if (!nv.code || typeof nv.code !== "string" || nv.code.trim() === "") {
          errors.push({ field: "nouvelleVague.code", message: "Le code de la nouvelle vague est obligatoire et non vide." });
        }
        if (!nv.dateDebut || typeof nv.dateDebut !== "string" || isNaN(Date.parse(nv.dateDebut))) {
          errors.push({ field: "nouvelleVague.dateDebut", message: "La date de debut de la nouvelle vague doit etre une chaine ISO 8601 valide." });
        }
      }
    } else if (mode === ModeTransfert.USE_EXISTING) {
      if (!body.vagueDestId || typeof body.vagueDestId !== "string" || body.vagueDestId.trim() === "") {
        errors.push({ field: "vagueDestId", message: "L'ID de la vague destination est obligatoire en mode USE_EXISTING." });
      }
    }

    // Valider groupes
    if (!Array.isArray(body.groupes) || body.groupes.length === 0) {
      errors.push({ field: "groupes", message: "Au moins un groupe est obligatoire." });
    } else {
      body.groupes.forEach((g: unknown, index: number) => {
        const groupe = g as Record<string, unknown>;
        if (!groupe.vagueSourceId || typeof groupe.vagueSourceId !== "string" || (groupe.vagueSourceId as string).trim() === "") {
          errors.push({ field: `groupes[${index}].vagueSourceId`, message: "vagueSourceId est obligatoire." });
        }
        if (typeof groupe.nombrePoissons !== "number" || !Number.isInteger(groupe.nombrePoissons) || groupe.nombrePoissons <= 0) {
          errors.push({ field: `groupes[${index}].nombrePoissons`, message: "nombrePoissons doit etre un entier > 0." });
        }
        if (typeof groupe.poidsMoyenG !== "number" || groupe.poidsMoyenG <= 0) {
          errors.push({ field: `groupes[${index}].poidsMoyenG`, message: "poidsMoyenG doit etre un nombre > 0." });
        }
        if (groupe.nombreMorts !== undefined && groupe.nombreMorts !== null) {
          if (typeof groupe.nombreMorts !== "number" || !Number.isInteger(groupe.nombreMorts) || groupe.nombreMorts < 0) {
            errors.push({ field: `groupes[${index}].nombreMorts`, message: "nombreMorts doit etre un entier >= 0." });
          }
        }
        if (!groupe.bacDestId || typeof groupe.bacDestId !== "string" || (groupe.bacDestId as string).trim() === "") {
          errors.push({ field: `groupes[${index}].bacDestId`, message: "Bac destination obligatoire." });
        }
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    let dto: CreateTransfertDTO;
    if (mode === ModeTransfert.CREATE_NEW) {
      dto = {
        mode: ModeTransfert.CREATE_NEW,
        nouvelleVague: {
          code: body.nouvelleVague.code.trim(),
          dateDebut: body.nouvelleVague.dateDebut,
          poidsObjectifKg: body.nouvelleVague.poidsObjectifKg ?? null,
          uniteProductionId: body.nouvelleVague.uniteProductionId ?? null,
          notes: body.nouvelleVague.notes ?? null,
        },
        groupes: body.groupes.map((g: Record<string, unknown>) => ({
          vagueSourceId: g.vagueSourceId as string,
          bacSourceId: (g.bacSourceId as string | null | undefined) ?? null,
          bacDestId: g.bacDestId as string,
          nombrePoissons: g.nombrePoissons as number,
          poidsMoyenG: g.poidsMoyenG as number,
          nombreMorts: typeof g.nombreMorts === "number" ? g.nombreMorts : 0,
        })),
        notes: body.notes ?? null,
        date: typeof body.date === "string" ? body.date : undefined,
      };
    } else {
      dto = {
        mode: ModeTransfert.USE_EXISTING,
        vagueDestId: body.vagueDestId,
        groupes: body.groupes.map((g: Record<string, unknown>) => ({
          vagueSourceId: g.vagueSourceId as string,
          bacSourceId: (g.bacSourceId as string | null | undefined) ?? null,
          bacDestId: g.bacDestId as string,
          nombrePoissons: g.nombrePoissons as number,
          poidsMoyenG: g.poidsMoyenG as number,
          nombreMorts: typeof g.nombreMorts === "number" ? g.nombreMorts : 0,
        })),
        notes: body.notes ?? null,
        date: typeof body.date === "string" ? body.date : undefined,
      };
    }

    const result = await createTransfert(auth.activeSiteId, auth.userId, dto);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/transferts", error, "Erreur serveur lors de la creation du transfert.", {
      statusMap: [
        { match: ["Conservation violée", "Modification impossible", "Annulation impossible"], status: 409 },
        { match: ["n'est pas EN_COURS", "n'est pas de type", "déjà utilisé", "introuvable"], status: 400 },
      ],
    });
  }
}
