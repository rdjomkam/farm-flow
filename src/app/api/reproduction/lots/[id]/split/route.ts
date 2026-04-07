import { NextRequest, NextResponse } from "next/server";
import { splitLot } from "@/lib/queries/lots-alevins";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { SplitLotDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.LOTS_ALEVINS_GERER);
    const { id } = await params;
    const body = await request.json();

    const errors: { field: string; message: string }[] = [];

    // sousLots — required array
    if (!body.sousLots || !Array.isArray(body.sousLots)) {
      errors.push({
        field: "sousLots",
        message: "Le tableau des sous-lots est obligatoire.",
      });
    } else if (body.sousLots.length === 0) {
      errors.push({
        field: "sousLots",
        message: "Au moins un sous-lot est requis pour le fractionnement.",
      });
    } else {
      // Validate each sous-lot
      (
        body.sousLots as Array<{ nombrePoissons?: unknown; code?: unknown; bacId?: unknown; notes?: unknown }>
      ).forEach((sl, index) => {
          if (
            sl.nombrePoissons === undefined ||
            sl.nombrePoissons === null ||
            typeof sl.nombrePoissons !== "number" ||
            !Number.isInteger(sl.nombrePoissons) ||
            sl.nombrePoissons <= 0
          ) {
            errors.push({
              field: `sousLots[${index}].nombrePoissons`,
              message: `Le sous-lot ${index + 1} doit avoir un nombre de poissons > 0.`,
            });
          }
        }
      );
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: SplitLotDTO = {
      sousLots: (
        body.sousLots as Array<{
          nombrePoissons: number;
          code?: string;
          bacId?: string;
          notes?: string;
        }>
      ).map((sl) => ({
        nombrePoissons: sl.nombrePoissons,
        code: sl.code?.trim() ?? undefined,
        bacId: sl.bacId ?? undefined,
        notes: sl.notes?.trim() ?? undefined,
      })),
      releveTriId: body.releveTriId ?? undefined,
    };

    const sousLots = await splitLot(id, auth.activeSiteId, dto);

    return NextResponse.json({ data: sousLots, total: sousLots.length }, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/reproduction/lots/[id]/split",
      error,
      "Erreur serveur lors du fractionnement du lot d'alevins."
    );
  }
}
