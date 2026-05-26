import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { CreateArrivageDTO, ArrivageGroupeInputDTO } from "@/types";
import { createArrivage } from "@/lib/queries/arrivages";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_CREER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validation manuelle (pattern calibrages/transferts)
    if (!body.vagueId || typeof body.vagueId !== "string" || body.vagueId.trim() === "") {
      errors.push({ field: "vagueId", message: "vagueId obligatoire" });
    }

    if (!Array.isArray(body.groupes) || body.groupes.length === 0) {
      errors.push({ field: "groupes", message: "Au moins un groupe est obligatoire" });
    } else {
      body.groupes.forEach((g: unknown, i: number) => {
        const groupe = g as Record<string, unknown>;
        if (!groupe.destinationBacId || typeof groupe.destinationBacId !== "string") {
          errors.push({ field: `groupes[${i}].destinationBacId`, message: "destinationBacId obligatoire" });
        }
        if (typeof groupe.nombrePoissons !== "number" || !Number.isInteger(groupe.nombrePoissons) || groupe.nombrePoissons <= 0) {
          errors.push({ field: `groupes[${i}].nombrePoissons`, message: "nombrePoissons doit être un entier > 0" });
        }
        if (typeof groupe.poidsMoyen !== "number" || groupe.poidsMoyen <= 0) {
          errors.push({ field: `groupes[${i}].poidsMoyen`, message: "poidsMoyen doit être > 0" });
        }
      });
    }

    if (body.date !== undefined && (typeof body.date !== "string" || isNaN(Date.parse(body.date)))) {
      errors.push({ field: "date", message: "date doit être ISO 8601" });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: CreateArrivageDTO = {
      vagueId: body.vagueId,
      date: body.date,
      origine: typeof body.origine === "string" ? body.origine.trim() || undefined : undefined,
      notes: typeof body.notes === "string" ? body.notes.trim() || undefined : undefined,
      groupes: body.groupes.map((g: Record<string, unknown>) => ({
        destinationBacId: g.destinationBacId as string,
        nombrePoissons: g.nombrePoissons as number,
        poidsMoyen: g.poidsMoyen as number,
      } as ArrivageGroupeInputDTO)),
    };

    const arrivage = await createArrivage(auth.activeSiteId, auth.userId, dto);
    return NextResponse.json(arrivage, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/arrivages", error, "Erreur lors de la création de l'arrivage.", {
      statusMap: [
        { match: ["pré-grossissement", "EN_COURS", "n'est pas de type", "introuvable", "conflit"], status: 400 },
      ],
    });
  }
}
