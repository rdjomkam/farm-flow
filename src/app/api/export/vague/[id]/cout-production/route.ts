/**
 * GET /api/export/vague/[id]/cout-production
 *
 * Génère et télécharge le rapport de coût de production d'une vague en PDF.
 * Permissions requises : FINANCES_VOIR + EXPORT_DONNEES
 */

import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-utils";
import { getCoutProductionVague } from "@/lib/queries/finances";
import { renderCoutProductionPDF } from "@/lib/export/pdf-cout-production";
import { Permission } from "@/types";
import type { CreateCoutProductionPDFDTO } from "@/types/export";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(
      request,
      Permission.FINANCES_VOIR,
      Permission.EXPORT_DONNEES
    );

    const { id } = await params;

    // Charger les données de coût de production et les infos du site en parallèle
    const [coutProduction, site] = await Promise.all([
      getCoutProductionVague(id, auth.activeSiteId),
      prisma.site.findUnique({
        where: { id: auth.activeSiteId },
        select: { name: true, address: true },
      }),
    ]);

    if (!site) {
      return Response.json(
        { status: 404, message: "Site introuvable" },
        { status: 404 }
      );
    }

    // Construire le DTO
    const dto: CreateCoutProductionPDFDTO = {
      site: {
        name: site.name,
        address: site.address ?? null,
      },
      dateGeneration: new Date().toISOString(),
      coutProduction,
    };

    // Générer le PDF
    const buffer = await renderCoutProductionPDF(dto);
    const uint8 = new Uint8Array(buffer);

    return new Response(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cout-production-${coutProduction.vague.code}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    // P2025 = findUniqueOrThrow — vague introuvable
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "P2025"
    ) {
      return Response.json(
        { status: 404, message: "Vague introuvable" },
        { status: 404 }
      );
    }

    return handleApiError(
      "GET /api/export/vague/[id]/cout-production",
      error,
      "Erreur serveur lors de la génération du rapport de coût de production."
    );
  }
}
